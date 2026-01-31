// GET /api/cron/daily-provider-check
// Vercel Cron Job - Comprehensive daily provider management
// 
// This cron job runs the full provider discovery and maintenance pipeline:
// 
// 1. Health Check - Monitor existing provider health
// 2. Auto-Disable - Disable failing providers
// 3. Discovery - Search for new no-KYC swap providers
// 4. Validation - Test discovered providers
// 5. PR Creation - Create GitHub PRs for human review (NEVER auto-merge)
// 
// SAFETY GUARDRAILS:
// - All new providers require human PR review
// - Failing providers are auto-disabled
// - Maximum 3 PRs per day
// - Comprehensive logging for audit trail
// 
// To enable: Add to vercel.json crons configuration

import { NextRequest, NextResponse } from 'next/server';
import { runHealthCheck, getAllProviderHealth } from '@/lib/provider-health';
import { discoverNewProviders, isAutoMaintenanceEnabled } from '@/lib/ai-provider-discovery';
import { analyzeProviderApi, generateProviderCode, validateGeneratedCode } from '@/lib/provider-code-generator';
import { createProviderPR, isGitHubAutomationEnabled, canCreatePR, incrementPRCount, getRemainingPRQuota } from '@/lib/github-automation';
import { testGeneratedCode } from '@/lib/provider-testing';
import { cleanupExpiredRecords } from '@/lib/database';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret
  if (!cronSecret) {
    console.log('[DailyCron] No CRON_SECRET set - running in development mode');
    return true;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Pipeline result structure
 */
interface PipelineResult {
  success: boolean;
  timestamp: string;
  duration: number;
  phases: {
    healthCheck: {
      ran: boolean;
      overallHealth: string;
      autoDisabledCount: number;
      recommendations: string[];
    };
    discovery: {
      ran: boolean;
      providersFound: number;
      newPublicApiProviders: number;
    };
    validation: {
      ran: boolean;
      validated: number;
      failed: number;
    };
    prCreation: {
      ran: boolean;
      created: number;
      prUrls: string[];
      errors: string[];
    };
    cleanup: {
      ran: boolean;
    };
  };
  logs: string[];
  errors: string[];
}

/**
 * Run the complete daily pipeline
 */
async function runDailyPipeline(): Promise<PipelineResult> {
  const startTime = Date.now();
  const logs: string[] = [];
  const errors: string[] = [];
  
  const result: PipelineResult = {
    success: true,
    timestamp: new Date().toISOString(),
    duration: 0,
    phases: {
      healthCheck: { ran: false, overallHealth: 'unknown', autoDisabledCount: 0, recommendations: [] },
      discovery: { ran: false, providersFound: 0, newPublicApiProviders: 0 },
      validation: { ran: false, validated: 0, failed: 0 },
      prCreation: { ran: false, created: 0, prUrls: [], errors: [] },
      cleanup: { ran: false },
    },
    logs,
    errors,
  };
  
  try {
    // ========================================
    // PHASE 1: Health Check
    // ========================================
    logs.push('=== Phase 1: Health Check ===');
    console.log('[DailyCron] Phase 1: Running health check...');
    
    try {
      const healthResult = await runHealthCheck();
      result.phases.healthCheck = {
        ran: true,
        overallHealth: healthResult.overallHealth,
        autoDisabledCount: healthResult.autoDisabledCount,
        recommendations: healthResult.recommendations,
      };
      
      logs.push(`Health check complete: ${healthResult.overallHealth}`);
      logs.push(`Auto-disabled providers: ${healthResult.autoDisabledCount}`);
      
      if (healthResult.recommendations.length > 0) {
        logs.push('Recommendations:');
        healthResult.recommendations.forEach(r => logs.push(`  - ${r}`));
      }
      
      // Critical health = don't proceed with discovery
      if (healthResult.overallHealth === 'critical') {
        logs.push('CRITICAL: System health is critical. Skipping discovery phase.');
        errors.push('Pipeline stopped: critical health status');
        result.success = false;
        result.duration = Date.now() - startTime;
        return result;
      }
    } catch (error: any) {
      errors.push(`Health check failed: ${error.message}`);
      logs.push(`Health check error: ${error.message}`);
    }
    
    // ========================================
    // PHASE 2: Provider Discovery
    // ========================================
    logs.push('=== Phase 2: Provider Discovery ===');
    console.log('[DailyCron] Phase 2: Discovering new providers...');
    
    if (!isAutoMaintenanceEnabled()) {
      logs.push('AI maintenance not enabled (no ANTHROPIC_API_KEY). Skipping discovery.');
    } else {
      try {
        const discovered = await discoverNewProviders();
        
        // Filter to only new providers with public APIs
        const newPublicProviders = discovered.filter(p => 
          p.hasPublicApi && 
          !['exolix', 'fixedfloat'].includes(p.name.toLowerCase())
        );
        
        result.phases.discovery = {
          ran: true,
          providersFound: discovered.length,
          newPublicApiProviders: newPublicProviders.length,
        };
        
        logs.push(`Discovered ${discovered.length} providers total`);
        logs.push(`New providers with public APIs: ${newPublicProviders.length}`);
        
        // Store for next phase
        (result as any)._newProviders = newPublicProviders;
      } catch (error: any) {
        errors.push(`Discovery failed: ${error.message}`);
        logs.push(`Discovery error: ${error.message}`);
      }
    }
    
    // ========================================
    // PHASE 3: Validation & Code Generation
    // ========================================
    logs.push('=== Phase 3: Validation & Code Generation ===');
    console.log('[DailyCron] Phase 3: Validating discovered providers...');
    
    const newProviders = (result as any)._newProviders || [];
    const validatedProviders: any[] = [];
    
    if (newProviders.length === 0) {
      logs.push('No new providers to validate');
    } else if (!isAutoMaintenanceEnabled()) {
      logs.push('Cannot validate without AI API key');
    } else {
      // Limit to 3 providers per day to avoid rate limits
      const toValidate = newProviders.slice(0, 3);
      
      for (const provider of toValidate) {
        logs.push(`Analyzing ${provider.name}...`);
        
        try {
          // Analyze the API
          const analysis = await analyzeProviderApi(provider.name, provider.url);
          
          if (!analysis) {
            logs.push(`  - Could not analyze API`);
            result.phases.validation.failed++;
            continue;
          }
          
          if (!analysis.hasPublicApi) {
            logs.push(`  - API requires authentication, skipping`);
            result.phases.validation.failed++;
            continue;
          }
          
          // Generate code
          const generated = await generateProviderCode(analysis);
          
          if (!generated) {
            logs.push(`  - Code generation failed`);
            result.phases.validation.failed++;
            continue;
          }
          
          // Validate generated code
          const validation = validateGeneratedCode(generated.code);
          
          if (!validation.valid) {
            logs.push(`  - Validation failed: ${validation.errors.join(', ')}`);
            result.phases.validation.failed++;
            continue;
          }
          
          // Run static analysis
          const testResult = await testGeneratedCode(generated.code, generated.className);
          
          if (!testResult.success) {
            logs.push(`  - Static analysis failed: ${testResult.error}`);
            result.phases.validation.failed++;
            continue;
          }
          
          logs.push(`  - Validation passed`);
          result.phases.validation.validated++;
          validatedProviders.push({ provider, analysis, generated });
        } catch (error: any) {
          logs.push(`  - Error: ${error.message}`);
          result.phases.validation.failed++;
          errors.push(`Validation error for ${provider.name}: ${error.message}`);
        }
      }
      
      result.phases.validation.ran = true;
    }
    
    // ========================================
    // PHASE 4: PR Creation
    // ========================================
    logs.push('=== Phase 4: PR Creation ===');
    console.log('[DailyCron] Phase 4: Creating PRs for validated providers...');
    
    if (!isGitHubAutomationEnabled()) {
      logs.push('GitHub automation not enabled (no GITHUB_TOKEN). Skipping PR creation.');
    } else if (validatedProviders.length === 0) {
      logs.push('No validated providers to create PRs for');
    } else {
      result.phases.prCreation.ran = true;
      
      const remainingQuota = getRemainingPRQuota();
      logs.push(`PR quota remaining: ${remainingQuota}`);
      
      const toCreate = validatedProviders.slice(0, remainingQuota);
      
      for (const { provider, analysis, generated } of toCreate) {
        if (!canCreatePR()) {
          logs.push(`PR quota exhausted, skipping ${provider.name}`);
          continue;
        }
        
        logs.push(`Creating PR for ${provider.name}...`);
        
        try {
          const prResult = await createProviderPR(
            generated,
            null,  // Test results will be run in CI
            `Discovered via AI analysis. API: ${analysis.baseUrl}`
          );
          
          if (prResult.success) {
            incrementPRCount();
            result.phases.prCreation.created++;
            result.phases.prCreation.prUrls.push(prResult.prUrl!);
            logs.push(`  - Created PR #${prResult.prNumber}: ${prResult.prUrl}`);
          } else {
            result.phases.prCreation.errors.push(`${provider.name}: ${prResult.error}`);
            logs.push(`  - Failed: ${prResult.error}`);
          }
        } catch (error: any) {
          result.phases.prCreation.errors.push(`${provider.name}: ${error.message}`);
          logs.push(`  - Error: ${error.message}`);
          errors.push(`PR creation error for ${provider.name}: ${error.message}`);
        }
      }
    }
    
    // ========================================
    // PHASE 5: Cleanup
    // ========================================
    logs.push('=== Phase 5: Cleanup ===');
    console.log('[DailyCron] Phase 5: Running cleanup...');
    
    try {
      await cleanupExpiredRecords();
      result.phases.cleanup.ran = true;
      logs.push('Database cleanup complete');
    } catch (error: any) {
      logs.push(`Cleanup error: ${error.message}`);
      errors.push(`Cleanup failed: ${error.message}`);
    }
    
    // ========================================
    // Complete
    // ========================================
    logs.push('=== Pipeline Complete ===');
    result.duration = Date.now() - startTime;
    result.success = errors.length === 0;
    
    console.log('[DailyCron] Pipeline complete');
    console.log(`  Duration: ${result.duration}ms`);
    console.log(`  Errors: ${errors.length}`);
    
  } catch (error: any) {
    errors.push(`Pipeline error: ${error.message}`);
    result.success = false;
    result.duration = Date.now() - startTime;
    console.error('[DailyCron] Pipeline failed:', error);
  }
  
  return result;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[DailyCron] ====================================');
  console.log('[DailyCron] Starting daily provider pipeline...');
  console.log('[DailyCron] ====================================');
  
  const result = await runDailyPipeline();
  
  // Log summary
  console.log('[DailyCron] ====================================');
  console.log('[DailyCron] Pipeline Summary:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  Health: ${result.phases.healthCheck.overallHealth}`);
  console.log(`  Providers discovered: ${result.phases.discovery.providersFound}`);
  console.log(`  New public APIs: ${result.phases.discovery.newPublicApiProviders}`);
  console.log(`  Validated: ${result.phases.validation.validated}`);
  console.log(`  PRs created: ${result.phases.prCreation.created}`);
  console.log(`  Errors: ${result.errors.length}`);
  console.log('[DailyCron] ====================================');
  
  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}

// Also support POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
