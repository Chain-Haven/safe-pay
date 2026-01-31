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

export default function AdminPage() {
  const [providers, setProviders] = useState<ProvidersData | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningCron, setRunningCron] = useState(false);
  const [cronResult, setCronResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/health').then(r => r.json()),
      fetch('/api/v1/providers').then(r => r.json()),
    ]).then(([h, p]) => {
      setHealth(h);
      setProviders(p);
      setLoading(false);
    }).catch(() => setLoading(false));
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
      // Refresh providers
      const p = await fetch('/api/v1/providers').then(r => r.json());
      setProviders(p);
    } catch (error: any) {
      setCronResult({ error: error.message });
    } finally {
      setRunningCron(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">SafePay Admin</h1>
            <p className="text-gray-600 dark:text-gray-400">System status and provider management</p>
          </div>
          <Link href="/" className="text-primary-600 hover:text-primary-700">
            ← Back to Home
          </Link>
        </div>

        {/* Health Status */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">System Health</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
              <div className={`text-lg font-semibold ${
                health?.status === 'healthy' ? 'text-green-600' : 'text-red-600'
              }`}>
                {health?.status || 'Unknown'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Version</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {health?.version || '1.0.0'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">AI Maintenance</div>
              <div className={`text-lg font-semibold ${
                health?.features?.auto_maintenance ? 'text-green-600' : 'text-gray-500'
              }`}>
                {health?.features?.auto_maintenance ? 'Enabled' : 'Disabled'}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">Providers</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {providers?.active?.length || 0} Active
              </div>
            </div>
          </div>
        </div>

        {/* Active Providers */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Active Providers</h2>
          
          <div className="space-y-3">
            {providers?.active?.map((provider) => (
              <div
                key={provider.name}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {provider.displayName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    ID: {provider.name}
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  provider.enabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-400'
                }`}>
                  {provider.enabled ? 'Active' : 'Disabled'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Provider Discovery */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                AI Provider Discovery
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {providers?.auto_maintenance_enabled
                  ? 'Claude AI is scanning for new swap providers daily'
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
                  <div className="spinner !w-4 !h-4 !border-2 !border-white !border-t-transparent mr-2"></div>
                  Running...
                </>
              ) : (
                'Run Discovery Now'
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
                {cronResult.success ? 'Discovery Complete' : 'Discovery Failed'}
              </div>
              {cronResult.summary && (
                <div className="text-sm space-y-1">
                  <div>Discovered: {cronResult.summary.total_discovered}</div>
                  <div>New Public APIs: {cronResult.summary.new_public_api_providers}</div>
                  <div>Code Generated: {cronResult.summary.code_generated}</div>
                </div>
              )}
              {cronResult.error && (
                <div className="text-sm text-red-600">{cronResult.error}</div>
              )}
            </div>
          )}

          {/* Discovered Providers */}
          {providers?.discovered && providers.discovered.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 dark:text-white">Recently Discovered</h3>
              {providers.discovered.slice(0, 5).map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{d.name}</div>
                    <a
                      href={d.url}
                      target="_blank"
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
          )}
        </div>

        {/* Info */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Provider discovery runs daily at 6am UTC.
            {providers?.last_discovery && (
              <span> Last run: {new Date(providers.last_discovery).toLocaleString()}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
