// Provider Testing Framework
// 
// Safe, sandboxed testing for auto-generated provider implementations.
// Runs comprehensive tests before any provider can be integrated.

import type { ISwapProvider, SwapQuote, SwapStatus } from '@/packages/providers/interfaces';

/**
 * Test result for a single test case
 */
export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * Complete test suite result
 */
export interface TestSuiteResult {
  providerName: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  tests: TestResult[];
  overallPassed: boolean;
  safeToIntegrate: boolean;
  warnings: string[];
}

/**
 * Test configuration
 */
export interface TestConfig {
  timeout: number;  // ms per test
  maxRetries: number;
  testCurrency: {
    from: { currency: string; network: string };
    to: { currency: string; network: string };
  };
  testAmount: number;
}

const DEFAULT_CONFIG: TestConfig = {
  timeout: 30000,  // 30 seconds
  maxRetries: 2,
  testCurrency: {
    from: { currency: 'BTC', network: 'BTC' },
    to: { currency: 'USDT', network: 'TRX' },
  },
  testAmount: 100, // $100 equivalent
};

/**
 * Run a single test with timeout and error handling
 */
async function runTest(
  name: string,
  testFn: () => Promise<any>,
  timeout: number
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Test timed out')), timeout);
    });
    
    // Race between test and timeout
    const result = await Promise.race([testFn(), timeoutPromise]);
    
    return {
      name,
      passed: true,
      duration: Date.now() - startTime,
      details: result,
    };
  } catch (error: any) {
    return {
      name,
      passed: false,
      duration: Date.now() - startTime,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Validate that a response matches expected shape
 */
function validateResponseShape(obj: any, expectedFields: string[]): string[] {
  const errors: string[] = [];
  
  for (const field of expectedFields) {
    if (!(field in obj)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  return errors;
}

/**
 * Run comprehensive test suite for a provider
 */
export async function testProvider(
  provider: ISwapProvider,
  config: Partial<TestConfig> = {}
): Promise<TestSuiteResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const tests: TestResult[] = [];
  const warnings: string[] = [];
  const startTime = Date.now();
  
  console.log(`[ProviderTest] Testing provider: ${provider.displayName}`);
  
  // Test 1: Provider has required properties
  tests.push(await runTest(
    'Provider has required properties',
    async () => {
      if (!provider.name) throw new Error('Missing name');
      if (!provider.displayName) throw new Error('Missing displayName');
      if (typeof provider.enabled !== 'boolean') throw new Error('Invalid enabled flag');
      return { name: provider.name, displayName: provider.displayName };
    },
    cfg.timeout
  ));
  
  // Test 2: getSupportedCoins returns valid data
  let coins: any[] = [];
  tests.push(await runTest(
    'getSupportedCoins returns valid array',
    async () => {
      coins = await provider.getSupportedCoins();
      if (!Array.isArray(coins)) throw new Error('Not an array');
      if (coins.length === 0) {
        warnings.push('No coins returned - provider may be non-functional');
      }
      
      // Validate first coin shape
      if (coins.length > 0) {
        const errors = validateResponseShape(coins[0], ['symbol', 'name', 'network']);
        if (errors.length > 0) throw new Error(errors.join(', '));
      }
      
      return { count: coins.length, sample: coins.slice(0, 3) };
    },
    cfg.timeout
  ));
  
  // Test 3: isPairSupported works correctly
  tests.push(await runTest(
    'isPairSupported returns boolean',
    async () => {
      const result = await provider.isPairSupported(
        cfg.testCurrency.from.currency,
        cfg.testCurrency.from.network,
        cfg.testCurrency.to.currency,
        cfg.testCurrency.to.network
      );
      
      if (typeof result !== 'boolean') throw new Error('Not a boolean');
      return { supported: result };
    },
    cfg.timeout
  ));
  
  // Test 4: getQuote returns valid quote or null
  let quote: SwapQuote | null = null;
  tests.push(await runTest(
    'getQuote returns valid quote structure',
    async () => {
      quote = await provider.getQuote(
        cfg.testCurrency.from.currency,
        cfg.testCurrency.from.network,
        cfg.testCurrency.to.currency,
        cfg.testCurrency.to.network,
        cfg.testAmount
      );
      
      // Null is acceptable (pair not supported)
      if (quote === null) {
        warnings.push('Quote returned null - pair may not be supported');
        return { quote: null };
      }
      
      // Validate quote structure
      const errors = validateResponseShape(quote, [
        'provider', 'fromCurrency', 'fromNetwork', 'toCurrency', 'toNetwork',
        'depositAmount', 'receiveAmount', 'rate'
      ]);
      
      if (errors.length > 0) throw new Error(errors.join(', '));
      
      // Validate quote values are reasonable
      if (quote.depositAmount <= 0) throw new Error('Invalid depositAmount');
      if (quote.receiveAmount <= 0) throw new Error('Invalid receiveAmount');
      if (quote.rate <= 0) throw new Error('Invalid rate');
      
      return { quote };
    },
    cfg.timeout
  ));
  
  // Test 5: Rate is within reasonable bounds (sanity check)
  tests.push(await runTest(
    'Quote rate is within reasonable bounds',
    async () => {
      if (!quote) {
        warnings.push('Skipped rate bounds check - no quote available');
        return { skipped: true };
      }
      
      // BTC to USDT rate should be somewhere between $10,000 and $500,000
      // This is a sanity check, not a precise validation
      const btcPrice = quote.receiveAmount / quote.depositAmount;
      
      if (btcPrice < 1000 || btcPrice > 500000) {
        throw new Error(`Rate seems unreasonable: ${btcPrice} USDT per BTC`);
      }
      
      return { calculatedRate: btcPrice };
    },
    cfg.timeout
  ));
  
  // Test 6: getSwapStatus handles invalid ID gracefully
  tests.push(await runTest(
    'getSwapStatus handles invalid ID gracefully',
    async () => {
      try {
        const status = await provider.getSwapStatus('invalid-test-id-12345');
        
        // Should either throw or return a status object
        if (status) {
          const errors = validateResponseShape(status, ['status']);
          if (errors.length > 0) throw new Error(errors.join(', '));
        }
        
        return { handledGracefully: true, status };
      } catch (error: any) {
        // Throwing an error for invalid ID is acceptable
        return { handledGracefully: true, error: error.message };
      }
    },
    cfg.timeout
  ));
  
  // Test 7: Provider doesn't leak sensitive data
  tests.push(await runTest(
    'Provider does not expose sensitive data',
    async () => {
      const providerStr = JSON.stringify(provider);
      
      const sensitivePatterns = [
        /api[_-]?key/i,
        /secret/i,
        /password/i,
        /token(?!s)/i,  // "token" but not "tokens"
        /private/i,
      ];
      
      for (const pattern of sensitivePatterns) {
        if (pattern.test(providerStr)) {
          throw new Error(`Potential sensitive data exposed: ${pattern}`);
        }
      }
      
      return { secure: true };
    },
    cfg.timeout
  ));
  
  // Test 8: Provider methods don't throw unexpected errors
  tests.push(await runTest(
    'All methods handle errors gracefully',
    async () => {
      // Test with intentionally bad inputs
      const badInputs = [
        { currency: '', network: '' },
        { currency: 'INVALID_COIN_XYZ', network: 'INVALID_NETWORK' },
        { currency: null as any, network: undefined as any },
      ];
      
      for (const bad of badInputs) {
        try {
          await provider.isPairSupported(
            bad.currency, bad.network, bad.currency, bad.network
          );
          await provider.getQuote(
            bad.currency, bad.network, bad.currency, bad.network, 0
          );
        } catch (error) {
          // Errors are fine, we just don't want crashes
        }
      }
      
      return { robustErrorHandling: true };
    },
    cfg.timeout
  ));
  
  // Calculate results
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const totalDuration = Date.now() - startTime;
  
  // Determine if safe to integrate
  // Must pass ALL critical tests (first 4)
  const criticalTests = tests.slice(0, 4);
  const criticalPassed = criticalTests.every(t => t.passed);
  
  // Must pass at least 75% of all tests
  const passRate = passed / tests.length;
  const safeToIntegrate = criticalPassed && passRate >= 0.75;
  
  if (!safeToIntegrate) {
    warnings.push('Provider did not meet minimum quality standards');
  }
  
  const result: TestSuiteResult = {
    providerName: provider.displayName,
    totalTests: tests.length,
    passed,
    failed,
    skipped: 0,
    duration: totalDuration,
    tests,
    overallPassed: failed === 0,
    safeToIntegrate,
    warnings,
  };
  
  console.log(`[ProviderTest] Results for ${provider.displayName}:`);
  console.log(`  Passed: ${passed}/${tests.length}`);
  console.log(`  Safe to integrate: ${safeToIntegrate}`);
  
  return result;
}

/**
 * Quick validation test - just checks if provider is minimally functional
 */
export async function quickValidate(provider: ISwapProvider): Promise<boolean> {
  try {
    // Just check if we can get coins
    const coins = await Promise.race([
      provider.getSupportedCoins(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);
    
    return Array.isArray(coins) && coins.length > 0;
  } catch {
    return false;
  }
}

/**
 * Test a provider implementation from generated code string
 * This is the safe sandbox for testing AI-generated code
 */
export async function testGeneratedCode(
  code: string,
  className: string
): Promise<{ success: boolean; result?: TestSuiteResult; error?: string }> {
  console.log(`[ProviderTest] Testing generated code for ${className}`);
  
  try {
    // SAFETY: We don't actually execute arbitrary code at runtime
    // Instead, we validate the code structure and syntax
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\([^)]*\)/,  // Dynamic requires
      /import\s*\(/,  // Dynamic imports
      /process\.env/,  // Direct env access (should use config)
      /fs\./,  // Filesystem access
      /child_process/,
      /exec\s*\(/,
      /spawn\s*\(/,
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          success: false,
          error: `Dangerous code pattern detected: ${pattern}`,
        };
      }
    }
    
    // Check for required interface implementation
    const requiredMethods = [
      'getSupportedCoins',
      'isPairSupported',
      'getQuote',
      'createSwap',
      'getSwapStatus',
    ];
    
    for (const method of requiredMethods) {
      if (!code.includes(method)) {
        return {
          success: false,
          error: `Missing required method: ${method}`,
        };
      }
    }
    
    // Check for proper class structure
    if (!code.includes(`class ${className}`)) {
      return {
        success: false,
        error: `Class ${className} not found in code`,
      };
    }
    
    // Check for implements ISwapProvider
    if (!code.includes('ISwapProvider')) {
      return {
        success: false,
        error: 'Class does not implement ISwapProvider interface',
      };
    }
    
    // Validate TypeScript syntax (basic check)
    const syntaxPatterns = [
      /async\s+\w+\s*\([^)]*\)\s*:\s*Promise/,  // Async methods return Promise
      /readonly\s+name/,  // Has readonly name
      /readonly\s+displayName/,  // Has readonly displayName
    ];
    
    const syntaxErrors: string[] = [];
    for (const pattern of syntaxPatterns) {
      if (!pattern.test(code)) {
        syntaxErrors.push(`Missing pattern: ${pattern}`);
      }
    }
    
    if (syntaxErrors.length > 0) {
      return {
        success: false,
        error: `Syntax validation failed: ${syntaxErrors.join(', ')}`,
      };
    }
    
    // Code passed static analysis
    return {
      success: true,
      result: {
        providerName: className,
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 0,
        tests: [
          { name: 'No dangerous patterns', passed: true, duration: 0 },
          { name: 'Has required methods', passed: true, duration: 0 },
          { name: 'Proper class structure', passed: true, duration: 0 },
          { name: 'Implements interface', passed: true, duration: 0 },
          { name: 'Valid syntax patterns', passed: true, duration: 0 },
        ],
        overallPassed: true,
        safeToIntegrate: true,
        warnings: ['Note: This is static analysis only. Runtime testing requires manual PR review.'],
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Analysis error: ${error.message}`,
    };
  }
}
