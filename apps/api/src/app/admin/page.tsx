'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Provider {
  name: string;
  displayName: string;
  enabled: boolean;
}

interface DiscoveredProvider {
  name: string;
  url: string;
  has_public_api: boolean;
  requires_auth: boolean;
  status: string;
  discovered_at: string;
}

interface ProvidersData {
  active: Provider[];
  discovered: DiscoveredProvider[];
  auto_maintenance_enabled: boolean;
  last_discovery: string | null;
}

interface ProviderHealthData {
  name: string;
  enabled: boolean;
  autoDisabled: boolean;
  disabledReason?: string;
  healthScore: number;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    lastError?: string;
  };
  lastHealthCheck?: string;
}

interface HealthData {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'critical';
  summary: {
    totalProviders: number;
    activeProviders: number;
    autoDisabledProviders: number;
    averageHealthScore: number;
  };
  config: {
    aiDiscoveryEnabled: boolean;
    githubAutomationEnabled: boolean;
    remainingPRQuota: number;
    supabaseConfigured: boolean;
    cronSecretSet: boolean;
  };
  providers: ProviderHealthData[];
}

export default function AdminPage() {
  const [providers, setProviders] = useState<ProvidersData | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningCron, setRunningCron] = useState(false);
  const [cronResult, setCronResult] = useState<any>(null);

  const fetchData = async () => {
    try {
      const [h, p, hd] = await Promise.all([
        fetch('/api/health').then(r => r.json()),
        fetch('/api/v1/providers').then(r => r.json()),
        fetch('/api/admin/health').then(r => r.json()).catch(() => null),
      ]);
      setHealth(h);
      setProviders(p);
      setHealthData(hd);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const runProviderDiscovery = async () => {
    setRunningCron(true);
    setCronResult(null);
    try {
      const response = await fetch('/api/cron/daily-provider-check', {
        method: 'POST',
      });
      const result = await response.json();
      setCronResult(result);
      // Refresh all data
      await fetchData();
    } catch (error: any) {
      setCronResult({ error: error.message });
    } finally {
      setRunningCron(false);
    }
  };

  const runHealthCheck = async () => {
    try {
      await fetch('/api/admin/health', { method: 'POST' });
      await fetchData();
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const statusColors = {
    healthy: 'text-green-600 bg-green-100 dark:bg-green-900/30',
    degraded: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30',
    critical: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">SafePay Admin</h1>
            <p className="text-gray-600 dark:text-gray-400">System monitoring and provider management</p>
          </div>
          <Link href="/" className="text-primary-600 hover:text-primary-700">
            ← Back to Home
          </Link>
        </div>

        {/* System Status Overview */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Status</h2>
            <button
              onClick={runHealthCheck}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              Refresh
            </button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Overall Health</div>
              <div className={`text-lg font-semibold px-2 py-1 rounded inline-block ${
                statusColors[healthData?.overallStatus || 'healthy']
              }`}>
                {healthData?.overallStatus?.toUpperCase() || health?.status?.toUpperCase() || 'UNKNOWN'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Health Score</div>
              <div className={`text-2xl font-bold ${
                (healthData?.summary?.averageHealthScore || 0) >= 70 ? 'text-green-600' :
                (healthData?.summary?.averageHealthScore || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {healthData?.summary?.averageHealthScore || 100}%
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Active Providers</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {healthData?.summary?.activeProviders || providers?.active?.length || 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Auto-Disabled</div>
              <div className={`text-2xl font-bold ${
                (healthData?.summary?.autoDisabledProviders || 0) > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {healthData?.summary?.autoDisabledProviders || 0}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Version</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {health?.version || '1.0.0'}
              </div>
            </div>
          </div>
        </div>

        {/* Automation Configuration */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Automation Status</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className={`w-3 h-3 rounded-full ${
                healthData?.config?.aiDiscoveryEnabled ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">AI Discovery</div>
                <div className="text-xs text-gray-500">
                  {healthData?.config?.aiDiscoveryEnabled ? 'Enabled' : 'Set ANTHROPIC_API_KEY'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className={`w-3 h-3 rounded-full ${
                healthData?.config?.githubAutomationEnabled ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">GitHub PRs</div>
                <div className="text-xs text-gray-500">
                  {healthData?.config?.githubAutomationEnabled 
                    ? `${healthData?.config?.remainingPRQuota}/3 quota` 
                    : 'Set GITHUB_TOKEN'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className={`w-3 h-3 rounded-full ${
                healthData?.config?.supabaseConfigured ? 'bg-green-500' : 'bg-gray-400'
              }`} />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Database</div>
                <div className="text-xs text-gray-500">
                  {healthData?.config?.supabaseConfigured ? 'Connected' : 'Not configured'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className={`w-3 h-3 rounded-full ${
                healthData?.config?.cronSecretSet ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Cron Security</div>
                <div className="text-xs text-gray-500">
                  {healthData?.config?.cronSecretSet ? 'Secured' : 'Warning: No secret'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Provider Health Details */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Provider Health</h2>
          
          <div className="space-y-3">
            {(healthData?.providers || providers?.active || []).map((provider: any) => {
              const healthProvider = healthData?.providers?.find((p: any) => p.name === provider.name);
              const score = healthProvider?.healthScore ?? 100;
              const metrics = healthProvider?.metrics || {};
              
              return (
                <div
                  key={provider.name}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        healthProvider?.autoDisabled ? 'bg-red-500' :
                        !healthProvider?.enabled ? 'bg-gray-400' :
                        score >= 70 ? 'bg-green-500' :
                        score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {provider.displayName || provider.name}
                        </div>
                        {healthProvider?.autoDisabled && (
                          <div className="text-xs text-red-500">
                            Auto-disabled: {healthProvider.disabledReason}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${
                          score >= 70 ? 'text-green-600' :
                          score >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {score}%
                        </div>
                        <div className="text-xs text-gray-500">Health Score</div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        healthProvider?.autoDisabled
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : provider.enabled
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-400'
                      }`}>
                        {healthProvider?.autoDisabled ? 'Auto-Disabled' : provider.enabled ? 'Active' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                  
                  {metrics.totalRequests > 0 && (
                    <div className="grid grid-cols-4 gap-2 text-sm">
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div className="font-medium text-gray-900 dark:text-white">{metrics.totalRequests}</div>
                        <div className="text-xs text-gray-500">Requests</div>
                      </div>
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div className="font-medium text-green-600">{metrics.successfulRequests}</div>
                        <div className="text-xs text-gray-500">Success</div>
                      </div>
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div className="font-medium text-red-600">{metrics.failedRequests}</div>
                        <div className="text-xs text-gray-500">Failed</div>
                      </div>
                      <div className="text-center p-2 bg-gray-100 dark:bg-gray-600 rounded">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {(metrics.averageLatency / 1000).toFixed(1)}s
                        </div>
                        <div className="text-xs text-gray-500">Avg Latency</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Provider Discovery */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                AI Provider Discovery Pipeline
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {healthData?.config?.aiDiscoveryEnabled
                  ? 'Claude AI discovers new providers → Tests → Creates PRs for human review'
                  : 'Set ANTHROPIC_API_KEY to enable automatic discovery'}
              </p>
            </div>
            <button
              onClick={runProviderDiscovery}
              disabled={runningCron}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center"
            >
              {runningCron ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Running Pipeline...
                </>
              ) : (
                'Run Full Pipeline'
              )}
            </button>
          </div>

          {cronResult && (
            <div className={`p-4 rounded-xl mb-4 ${
              cronResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            }`}>
              <div className="font-medium mb-2">
                {cronResult.success ? '✅ Pipeline Complete' : '❌ Pipeline Failed'}
              </div>
              
              {cronResult.phases && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm mb-3">
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                    <div className="text-xs text-gray-500">Health</div>
                    <div className={`font-medium ${
                      cronResult.phases.healthCheck.overallHealth === 'healthy' ? 'text-green-600' :
                      cronResult.phases.healthCheck.overallHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {cronResult.phases.healthCheck.overallHealth || 'N/A'}
                    </div>
                  </div>
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                    <div className="text-xs text-gray-500">Discovered</div>
                    <div className="font-medium">{cronResult.phases.discovery.providersFound}</div>
                  </div>
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                    <div className="text-xs text-gray-500">New Public</div>
                    <div className="font-medium">{cronResult.phases.discovery.newPublicApiProviders}</div>
                  </div>
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                    <div className="text-xs text-gray-500">Validated</div>
                    <div className="font-medium text-green-600">{cronResult.phases.validation.validated}</div>
                  </div>
                  <div className="p-2 bg-white/50 dark:bg-black/20 rounded">
                    <div className="text-xs text-gray-500">PRs Created</div>
                    <div className="font-medium text-primary-600">{cronResult.phases.prCreation.created}</div>
                  </div>
                </div>
              )}
              
              {cronResult.phases?.prCreation?.prUrls?.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-medium mb-1">Created PRs:</div>
                  {cronResult.phases.prCreation.prUrls.map((url: string, i: number) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      className="text-sm text-primary-600 hover:underline block"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
              
              {cronResult.errors?.length > 0 && (
                <div className="text-sm text-red-600">
                  Errors: {cronResult.errors.join(', ')}
                </div>
              )}
              
              <div className="text-xs text-gray-500 mt-2">
                Duration: {cronResult.duration}ms
              </div>
            </div>
          )}

          {/* Pipeline Safety Info */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-2">🛡️ Safety Guardrails</h3>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• New providers always require human PR review (never auto-merged)</li>
              <li>• Maximum 3 PRs created per day to prevent spam</li>
              <li>• Generated code is statically analyzed for security issues</li>
              <li>• Failing providers are automatically disabled</li>
              <li>• All actions are logged for audit trail</li>
            </ul>
          </div>
        </div>

        {/* Discovered Providers */}
        {providers?.discovered && providers.discovered.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Recently Discovered Providers
            </h2>
            <div className="space-y-3">
              {providers.discovered.slice(0, 10).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{d.name}</div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline"
                    >
                      {d.url}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      d.has_public_api && !d.requires_auth
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {d.has_public_api && !d.requires_auth ? 'Public API' : 'Needs Auth'}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      d.status === 'integrated' ? 'bg-green-100 text-green-700' :
                      d.status === 'reviewed' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {d.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Discovery pipeline runs daily at 6:00 AM UTC.
            {providers?.last_discovery && (
              <span> Last run: {new Date(providers.last_discovery).toLocaleString()}</span>
            )}
          </p>
          <p className="mt-1">
            All automated changes require human approval via GitHub PR.
          </p>
        </div>
      </div>
    </div>
  );
}
