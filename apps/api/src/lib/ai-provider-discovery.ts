// AI-Powered Provider Discovery System
// 
// This module uses Claude AI to discover, analyze, and potentially
// auto-generate code for new no-KYC crypto swap API providers.
// 
// Features:
// 1. Web search for new providers
// 2. API analysis and documentation parsing
// 3. Automatic provider class generation (when API key available)
// 4. GitHub PR creation for review

import Anthropic from '@anthropic-ai/sdk';
import { KNOWN_SWAP_PROVIDERS } from '@/packages/shared';
import { isSupabaseConfigured } from './supabase';

// Claude API client (initialized only if key is available)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic | null {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/**
 * Known crypto swap aggregator/review sites to scan
 */
const DISCOVERY_SOURCES = [
  'https://swapzone.io/exchanges',
  'https://coinmarketcap.com/rankings/exchanges/',
  'https://www.coingecko.com/en/exchanges/decentralized',
  'https://kycnot.me/',
  'https://github.com/nicehash/exchange-api-docs',
];

/**
 * Search terms for finding new providers
 */
const SEARCH_TERMS = [
  'no kyc crypto swap api',
  'instant crypto exchange api public',
  'cryptocurrency swap api free',
  'crypto exchange api no registration',
  'non custodial swap api',
];

/**
 * Result of provider analysis
 */
export interface ProviderAnalysis {
  name: string;
  url: string;
  apiDocUrl?: string;
  hasPublicApi: boolean;
  requiresApiKey: boolean;
  supportedFeatures: string[];
  notes: string;
  confidence: number; // 0-1 confidence score
}

/**
 * Generated provider code
 */
export interface GeneratedProviderCode {
  className: string;
  code: string;
  testCode: string;
  integrationNotes: string;
}

/**
 * Discover new potential swap providers using web search
 * This is a simplified version that checks known sources
 */
export async function discoverNewProviders(): Promise<ProviderAnalysis[]> {
  console.log('[ProviderDiscovery] Starting provider discovery...');
  
  const discoveries: ProviderAnalysis[] = [];
  const client = getAnthropicClient();
  
  // If we have Claude API, use it for intelligent analysis
  if (client) {
    console.log('[ProviderDiscovery] Using Claude AI for intelligent discovery');
    
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are a cryptocurrency API researcher. Your task is to identify crypto swap/exchange platforms that have PUBLIC APIs that work WITHOUT requiring an API key or registration.

Currently known providers with public APIs:
- Exolix (https://exolix.com/api) - Fully public, no auth
- FixedFloat (https://ff.io/api) - Mostly public

Research and list any OTHER crypto swap platforms that:
1. Have publicly documented APIs
2. Allow creating swaps without API key authentication
3. Are currently operational (not defunct)
4. Support fixed-rate exchanges

For each provider found, provide:
- Name
- Website URL
- API documentation URL (if known)
- Whether it truly requires no API key for basic swap operations
- Any limitations or notes

Format as JSON array. Only include providers you are confident have truly public APIs.
If you're not sure about a provider, mention it in notes but mark hasPublicApi as false.`,
          },
        ],
      });

      // Parse Claude's response
      const content = response.content[0];
      if (content.type === 'text') {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const providers = JSON.parse(jsonMatch[0]);
            for (const p of providers) {
              discoveries.push({
                name: p.name,
                url: p.url || p.website,
                apiDocUrl: p.apiDocUrl || p.apiUrl,
                hasPublicApi: p.hasPublicApi ?? false,
                requiresApiKey: p.requiresApiKey ?? true,
                supportedFeatures: p.features || [],
                notes: p.notes || '',
                confidence: p.confidence || 0.5,
              });
            }
          } catch (parseError) {
            console.error('[ProviderDiscovery] Failed to parse Claude response:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('[ProviderDiscovery] Claude API error:', error);
    }
  }
  
  // Also check against known providers list
  for (const known of KNOWN_SWAP_PROVIDERS) {
    const existing = discoveries.find(d => 
      d.url.toLowerCase().includes(known.url.toLowerCase().replace('https://', ''))
    );
    
    if (!existing) {
      discoveries.push({
        name: known.name,
        url: known.url,
        hasPublicApi: known.hasPublicApi,
        requiresApiKey: !known.hasPublicApi,
        supportedFeatures: [],
        notes: (known as any).note || '',
        confidence: 0.9,
      });
    }
  }
  
  // Save discoveries to database (if configured)
  if (isSupabaseConfigured) {
    const { saveProviderDiscovery } = await import('./database');
    for (const discovery of discoveries) {
      await saveProviderDiscovery({
        name: discovery.name,
        url: discovery.url,
        hasPublicApi: discovery.hasPublicApi,
        requiresAuth: discovery.requiresApiKey,
        notes: discovery.notes,
      });
    }
  }
  
  console.log(`[ProviderDiscovery] Found ${discoveries.length} providers`);
  return discoveries;
}

/**
 * Analyze a specific provider's API to determine if it can be integrated
 */
export async function analyzeProviderApi(
  name: string,
  apiDocUrl: string
): Promise<ProviderAnalysis | null> {
  const client = getAnthropicClient();
  
  if (!client) {
    console.log('[ProviderDiscovery] No Claude API key, skipping API analysis');
    return null;
  }
  
  console.log(`[ProviderDiscovery] Analyzing ${name} API at ${apiDocUrl}`);
  
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze the crypto swap API at ${apiDocUrl} for ${name}.

Determine:
1. Does it require API key/authentication for basic operations?
2. Can you create a swap without registration?
3. What endpoints are available?
4. Does it support fixed-rate exchanges?
5. What's the request/response format?

Provide a detailed analysis in JSON format with:
{
  "name": "${name}",
  "url": "${apiDocUrl}",
  "hasPublicApi": boolean,
  "requiresApiKey": boolean,
  "endpoints": {
    "rate": "endpoint path",
    "create": "endpoint path",
    "status": "endpoint path"
  },
  "supportsFixedRate": boolean,
  "notes": "any important notes",
  "confidence": 0-1 score
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error(`[ProviderDiscovery] Failed to analyze ${name}:`, error);
  }
  
  return null;
}

/**
 * Generate provider implementation code using Claude
 */
export async function generateProviderCode(
  analysis: ProviderAnalysis
): Promise<GeneratedProviderCode | null> {
  const client = getAnthropicClient();
  
  if (!client) {
    console.log('[ProviderDiscovery] No Claude API key, skipping code generation');
    return null;
  }
  
  if (!analysis.hasPublicApi) {
    console.log(`[ProviderDiscovery] ${analysis.name} requires API key, skipping`);
    return null;
  }
  
  console.log(`[ProviderDiscovery] Generating code for ${analysis.name}`);
  
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `Generate a TypeScript provider class for the ${analysis.name} crypto swap API.

API Details:
${JSON.stringify(analysis, null, 2)}

The class must implement this interface:
\`\`\`typescript
interface ISwapProvider {
  readonly name: SwapProvider;
  readonly displayName: string;
  readonly enabled: boolean;
  getSupportedCoins(): Promise<SupportedCoin[]>;
  isPairSupported(fromCurrency: string, fromNetwork: string, toCurrency: string, toNetwork: string): Promise<boolean>;
  getQuote(fromCurrency: string, fromNetwork: string, toCurrency: string, toNetwork: string, withdrawAmount: number): Promise<SwapQuote | null>;
  createSwap(fromCurrency: string, fromNetwork: string, toCurrency: string, toNetwork: string, withdrawAmount: number, withdrawAddress: string, withdrawMemo?: string): Promise<SwapDetails>;
  getSwapStatus(swapId: string): Promise<SwapStatus>;
}
\`\`\`

Requirements:
1. Use fetch for HTTP requests
2. Include proper error handling
3. Add timeout support
4. Map provider statuses to our normalized statuses
5. Include detailed comments

Return JSON with:
{
  "className": "ProviderNameProvider",
  "code": "// Full TypeScript code here",
  "testCode": "// Basic test code",
  "integrationNotes": "Notes for manual review"
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.error(`[ProviderDiscovery] Failed to generate code for ${analysis.name}:`, error);
  }
  
  return null;
}

/**
 * Main discovery function - runs the full pipeline
 */
export async function runProviderDiscoveryPipeline(): Promise<{
  discovered: ProviderAnalysis[];
  generated: GeneratedProviderCode[];
  logs: string[];
}> {
  const logs: string[] = [];
  const generated: GeneratedProviderCode[] = [];
  
  logs.push(`[${new Date().toISOString()}] Starting provider discovery pipeline`);
  
  // Step 1: Discover providers
  const discovered = await discoverNewProviders();
  logs.push(`Discovered ${discovered.length} providers`);
  
  // Step 2: Filter to only public API providers we don't already have
  const newPublicProviders = discovered.filter(p => 
    p.hasPublicApi && 
    !['exolix', 'fixedfloat'].includes(p.name.toLowerCase())
  );
  logs.push(`Found ${newPublicProviders.length} new providers with public APIs`);
  
  // Step 3: Try to generate code for each (if Claude API available)
  const client = getAnthropicClient();
  if (client && newPublicProviders.length > 0) {
    logs.push('Claude API available, attempting code generation...');
    
    for (const provider of newPublicProviders.slice(0, 3)) { // Limit to 3 to avoid rate limits
      logs.push(`Generating code for ${provider.name}...`);
      
      const code = await generateProviderCode(provider);
      if (code) {
        generated.push(code);
        logs.push(`Successfully generated code for ${provider.name}`);
      } else {
        logs.push(`Failed to generate code for ${provider.name}`);
      }
    }
  } else if (!client) {
    logs.push('No Claude API key configured - skipping code generation');
    logs.push('To enable automatic code generation, set ANTHROPIC_API_KEY environment variable');
  }
  
  logs.push(`[${new Date().toISOString()}] Pipeline complete`);
  
  return { discovered, generated, logs };
}

/**
 * Check if auto-maintenance is enabled (has AI API key)
 */
export function isAutoMaintenanceEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
