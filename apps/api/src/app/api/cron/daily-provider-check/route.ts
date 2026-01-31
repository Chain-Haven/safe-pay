// GET /api/cron/daily-provider-check
// Vercel Cron Job - Runs daily to discover new swap providers
// 
// This cron job:
// 1. Searches for new no-KYC crypto swap API providers
// 2. Analyzes found providers for public API availability
// 3. (If Claude API key set) Generates provider implementation code
// 4. Logs discoveries for manual review
// 
// To enable: Add to vercel.json crons configuration

import { NextRequest, NextResponse } from 'next/server';
import { 
  runProviderDiscoveryPipeline, 
  isAutoMaintenanceEnabled 
} from '@/lib/ai-provider-discovery';
import { cleanupExpiredRecords } from '@/lib/database';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow if no secret configured (development)
  if (!cronSecret) {
    return true;
  }
  
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[DailyCron] Starting daily provider check...');
  
  try {
    // Run provider discovery pipeline
    const { discovered, generated, logs } = await runProviderDiscoveryPipeline();
    
    // Clean up expired database records
    await cleanupExpiredRecords();
    
    // Log results
    console.log('[DailyCron] Discovery complete:');
    console.log(`- Discovered providers: ${discovered.length}`);
    console.log(`- Generated code for: ${generated.length}`);
    console.log(`- Auto-maintenance enabled: ${isAutoMaintenanceEnabled()}`);
    
    // Log interesting findings
    const publicApiProviders = discovered.filter(p => p.hasPublicApi && 
      !['exolix', 'fixedfloat'].includes(p.name.toLowerCase()));
    
    if (publicApiProviders.length > 0) {
      console.log('[DailyCron] New providers with public APIs found:');
      publicApiProviders.forEach(p => {
        console.log(`  - ${p.name}: ${p.url}`);
      });
    }

    // Return summary
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      auto_maintenance_enabled: isAutoMaintenanceEnabled(),
      summary: {
        total_discovered: discovered.length,
        new_public_api_providers: publicApiProviders.length,
        code_generated: generated.length,
      },
      discoveries: discovered.map(d => ({
        name: d.name,
        url: d.url,
        has_public_api: d.hasPublicApi,
        requires_api_key: d.requiresApiKey,
        confidence: d.confidence,
      })),
      generated_providers: generated.map(g => ({
        class_name: g.className,
        notes: g.integrationNotes,
      })),
      logs,
    });
  } catch (error: any) {
    console.error('[DailyCron] Error:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Also support POST for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
