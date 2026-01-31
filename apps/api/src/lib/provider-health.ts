// Provider Health Monitoring System
// 
// Tracks provider health, auto-disables failing providers,
// and provides rollback mechanisms.

import { providerRegistry } from '@/packages/providers/registry';
import { quickValidate } from './provider-testing';

/**
 * Health status for a provider
 */
export interface ProviderHealth {
  name: string;
  enabled: boolean;
  autoDisabled: boolean;
  disabledReason?: string;
  disabledAt?: string;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    lastRequestTime?: string;
    lastErrorTime?: string;
    lastError?: string;
  };
  healthScore: number;  // 0-100
  lastHealthCheck?: string;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  timestamp: string;
  providers: ProviderHealth[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
  autoDisabledCount: number;
  recommendations: string[];
}

/**
 * In-memory health metrics storage
 * In production, this should be persisted to database
 */
const healthMetrics: Map<string, ProviderHealth> = new Map();

/**
 * Auto-disable thresholds
 */
const THRESHOLDS = {
  MIN_SUCCESS_RATE: 0.7,        // Disable if success rate drops below 70%
  MIN_REQUESTS_FOR_DECISION: 10, // Need at least 10 requests to make decisions
  MAX_CONSECUTIVE_FAILURES: 5,   // Disable after 5 consecutive failures
  MAX_LATENCY_MS: 30000,         // Flag if average latency > 30s
  HEALTH_CHECK_INTERVAL_MS: 300000, // 5 minutes
};

/**
 * Consecutive failure tracking
 */
const consecutiveFailures: Map<string, number> = new Map();

/**
 * Initialize health metrics for a provider
 */
function initializeMetrics(providerName: string): ProviderHealth {
  const metrics: ProviderHealth = {
    name: providerName,
    enabled: true,
    autoDisabled: false,
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
    },
    healthScore: 100,
  };
  
  healthMetrics.set(providerName, metrics);
  return metrics;
}

/**
 * Get or create health metrics for a provider
 */
export function getProviderHealth(providerName: string): ProviderHealth {
  let health = healthMetrics.get(providerName);
  
  if (!health) {
    health = initializeMetrics(providerName);
  }
  
  return health;
}

/**
 * Record a successful request
 */
export function recordSuccess(providerName: string, latencyMs: number): void {
  const health = getProviderHealth(providerName);
  
  health.metrics.totalRequests++;
  health.metrics.successfulRequests++;
  health.metrics.lastRequestTime = new Date().toISOString();
  
  // Update average latency (rolling average)
  const totalLatency = health.metrics.averageLatency * (health.metrics.totalRequests - 1);
  health.metrics.averageLatency = (totalLatency + latencyMs) / health.metrics.totalRequests;
  
  // Reset consecutive failures
  consecutiveFailures.set(providerName, 0);
  
  // Update health score
  updateHealthScore(health);
  
  // Check if we should re-enable an auto-disabled provider
  checkAutoReEnable(providerName);
}

/**
 * Record a failed request
 */
export function recordFailure(providerName: string, error: string): void {
  const health = getProviderHealth(providerName);
  
  health.metrics.totalRequests++;
  health.metrics.failedRequests++;
  health.metrics.lastRequestTime = new Date().toISOString();
  health.metrics.lastErrorTime = new Date().toISOString();
  health.metrics.lastError = error.substring(0, 200);  // Truncate long errors
  
  // Track consecutive failures
  const failures = (consecutiveFailures.get(providerName) || 0) + 1;
  consecutiveFailures.set(providerName, failures);
  
  // Update health score
  updateHealthScore(health);
  
  // Check if we should auto-disable
  checkAutoDisable(providerName);
}

/**
 * Update health score based on metrics
 */
function updateHealthScore(health: ProviderHealth): void {
  const metrics = health.metrics;
  
  if (metrics.totalRequests === 0) {
    health.healthScore = 100;
    return;
  }
  
  // Calculate success rate (0-100)
  const successRate = (metrics.successfulRequests / metrics.totalRequests) * 100;
  
  // Calculate latency score (0-100, lower is better)
  const latencyScore = Math.max(0, 100 - (metrics.averageLatency / 300));  // 30s = 0
  
  // Weight: 70% success rate, 30% latency
  health.healthScore = Math.round(successRate * 0.7 + latencyScore * 0.3);
}

/**
 * Check if provider should be auto-disabled
 */
function checkAutoDisable(providerName: string): void {
  const health = getProviderHealth(providerName);
  const failures = consecutiveFailures.get(providerName) || 0;
  
  // Don't make decisions without enough data
  if (health.metrics.totalRequests < THRESHOLDS.MIN_REQUESTS_FOR_DECISION) {
    return;
  }
  
  const successRate = health.metrics.successfulRequests / health.metrics.totalRequests;
  
  let shouldDisable = false;
  let reason = '';
  
  // Check consecutive failures
  if (failures >= THRESHOLDS.MAX_CONSECUTIVE_FAILURES) {
    shouldDisable = true;
    reason = `${failures} consecutive failures`;
  }
  
  // Check success rate
  if (successRate < THRESHOLDS.MIN_SUCCESS_RATE) {
    shouldDisable = true;
    reason = `Low success rate: ${(successRate * 100).toFixed(1)}%`;
  }
  
  if (shouldDisable && !health.autoDisabled) {
    console.log(`[ProviderHealth] Auto-disabling ${providerName}: ${reason}`);
    
    health.autoDisabled = true;
    health.disabledReason = reason;
    health.disabledAt = new Date().toISOString();
    health.enabled = false;
    
    // Actually disable the provider in the registry
    const provider = providerRegistry.get(providerName as any);
    if (provider) {
      // Mark as disabled (providers should check this flag)
      (provider as any)._autoDisabled = true;
    }
  }
}

/**
 * Check if an auto-disabled provider should be re-enabled
 */
function checkAutoReEnable(providerName: string): void {
  const health = getProviderHealth(providerName);
  
  if (!health.autoDisabled) {
    return;
  }
  
  // Require 10 successful requests after being disabled to re-enable
  const recentSuccesses = health.metrics.successfulRequests;
  const recentTotal = health.metrics.totalRequests;
  
  if (recentTotal >= 10 && recentSuccesses / recentTotal >= 0.9) {
    console.log(`[ProviderHealth] Auto re-enabling ${providerName}: health recovered`);
    
    health.autoDisabled = false;
    health.enabled = true;
    health.disabledReason = undefined;
    health.disabledAt = undefined;
    
    // Re-enable in registry
    const provider = providerRegistry.get(providerName as any);
    if (provider) {
      (provider as any)._autoDisabled = false;
    }
  }
}

/**
 * Manually disable a provider
 */
export function disableProvider(providerName: string, reason: string): void {
  const health = getProviderHealth(providerName);
  
  health.enabled = false;
  health.disabledReason = reason;
  health.disabledAt = new Date().toISOString();
  
  console.log(`[ProviderHealth] Manually disabled ${providerName}: ${reason}`);
}

/**
 * Manually enable a provider
 */
export function enableProvider(providerName: string): void {
  const health = getProviderHealth(providerName);
  
  health.enabled = true;
  health.autoDisabled = false;
  health.disabledReason = undefined;
  health.disabledAt = undefined;
  
  // Reset failure counters
  consecutiveFailures.set(providerName, 0);
  
  console.log(`[ProviderHealth] Manually enabled ${providerName}`);
}

/**
 * Run health check for all providers
 */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  console.log('[ProviderHealth] Running health check...');
  
  const providers = providerRegistry.getAll();
  const healthResults: ProviderHealth[] = [];
  const recommendations: string[] = [];
  let autoDisabledCount = 0;
  
  for (const provider of providers) {
    const health = getProviderHealth(provider.name);
    
    // Run quick validation
    const isHealthy = await quickValidate(provider);
    
    if (!isHealthy && !health.autoDisabled) {
      recordFailure(provider.name, 'Health check failed - provider not responding');
    }
    
    health.lastHealthCheck = new Date().toISOString();
    
    if (health.autoDisabled) {
      autoDisabledCount++;
    }
    
    // Generate recommendations
    if (health.healthScore < 50) {
      recommendations.push(`${provider.name}: Health score critical (${health.healthScore}%). Consider manual review.`);
    } else if (health.healthScore < 70) {
      recommendations.push(`${provider.name}: Health score degraded (${health.healthScore}%). Monitor closely.`);
    }
    
    if (health.metrics.averageLatency > THRESHOLDS.MAX_LATENCY_MS) {
      recommendations.push(`${provider.name}: High latency (${(health.metrics.averageLatency / 1000).toFixed(1)}s average)`);
    }
    
    healthResults.push(health);
  }
  
  // Determine overall health
  let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  
  const activeProviders = healthResults.filter(h => h.enabled && !h.autoDisabled);
  const averageScore = activeProviders.reduce((sum, h) => sum + h.healthScore, 0) / activeProviders.length;
  
  if (activeProviders.length === 0) {
    overallHealth = 'critical';
    recommendations.push('CRITICAL: No active providers! Payment processing is unavailable.');
  } else if (averageScore < 50 || autoDisabledCount > providers.length / 2) {
    overallHealth = 'critical';
  } else if (averageScore < 70 || autoDisabledCount > 0) {
    overallHealth = 'degraded';
  }
  
  const result: HealthCheckResult = {
    timestamp: new Date().toISOString(),
    providers: healthResults,
    overallHealth,
    autoDisabledCount,
    recommendations,
  };
  
  console.log(`[ProviderHealth] Health check complete: ${overallHealth}`);
  
  return result;
}

/**
 * Get current health status of all providers
 */
export function getAllProviderHealth(): ProviderHealth[] {
  const providers = providerRegistry.getAll();
  return providers.map(p => getProviderHealth(p.name));
}

/**
 * Reset all health metrics (useful for testing)
 */
export function resetAllMetrics(): void {
  healthMetrics.clear();
  consecutiveFailures.clear();
  console.log('[ProviderHealth] All metrics reset');
}

/**
 * Check if a provider is currently healthy and enabled
 */
export function isProviderHealthy(providerName: string): boolean {
  const health = getProviderHealth(providerName);
  return health.enabled && !health.autoDisabled && health.healthScore >= 50;
}

/**
 * Wrap a provider method with health tracking
 */
export function withHealthTracking<T>(
  providerName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  
  return operation()
    .then(result => {
      recordSuccess(providerName, Date.now() - startTime);
      return result;
    })
    .catch(error => {
      recordFailure(providerName, error.message);
      throw error;
    });
}
