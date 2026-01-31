// GET /api/admin/health
// Provider health monitoring endpoint

import { NextRequest, NextResponse } from 'next/server';
import { runHealthCheck, getAllProviderHealth } from '@/lib/provider-health';
import { isAutoMaintenanceEnabled } from '@/lib/ai-provider-discovery';
import { isGitHubAutomationEnabled, getRemainingPRQuota } from '@/lib/github-automation';

export async function GET(request: NextRequest) {
  // Get current health status
  const providerHealth = getAllProviderHealth();
  
  // Get configuration status
  const config = {
    aiDiscoveryEnabled: isAutoMaintenanceEnabled(),
    githubAutomationEnabled: isGitHubAutomationEnabled(),
    remainingPRQuota: getRemainingPRQuota(),
    supabaseConfigured: !!process.env.SUPABASE_URL,
    cronSecretSet: !!process.env.CRON_SECRET,
  };
  
  // Calculate overall status
  const activeProviders = providerHealth.filter(p => p.enabled && !p.autoDisabled);
  const autoDisabledCount = providerHealth.filter(p => p.autoDisabled).length;
  const averageHealth = activeProviders.length > 0
    ? activeProviders.reduce((sum, p) => sum + p.healthScore, 0) / activeProviders.length
    : 0;
  
  let overallStatus: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (activeProviders.length === 0) {
    overallStatus = 'critical';
  } else if (averageHealth < 50 || autoDisabledCount > providerHealth.length / 2) {
    overallStatus = 'critical';
  } else if (averageHealth < 70 || autoDisabledCount > 0) {
    overallStatus = 'degraded';
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    overallStatus,
    summary: {
      totalProviders: providerHealth.length,
      activeProviders: activeProviders.length,
      autoDisabledProviders: autoDisabledCount,
      averageHealthScore: Math.round(averageHealth),
    },
    config,
    providers: providerHealth.map(p => ({
      name: p.name,
      enabled: p.enabled,
      autoDisabled: p.autoDisabled,
      disabledReason: p.disabledReason,
      healthScore: p.healthScore,
      metrics: p.metrics,
      lastHealthCheck: p.lastHealthCheck,
    })),
  });
}

// POST - Run a health check
export async function POST(request: NextRequest) {
  try {
    const result = await runHealthCheck();
    
    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
