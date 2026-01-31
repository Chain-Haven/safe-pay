// GET /api/v1/providers
// Get information about available swap providers
import { NextResponse } from 'next/server';
import { providerRegistry, initializeProviders } from '@/packages/providers';
import { getDiscoveredProviders } from '@/lib/database';
import { isAutoMaintenanceEnabled } from '@/lib/ai-provider-discovery';

export async function GET() {
  try {
    // Initialize providers
    initializeProviders();
    
    // Get active providers
    const activeProviders = providerRegistry.getEnabled().map(p => ({
      name: p.name,
      displayName: p.displayName,
      enabled: p.enabled,
    }));

    // Get discovered providers (from AI discovery)
    let discoveredProviders: any[] = [];
    try {
      discoveredProviders = await getDiscoveredProviders();
    } catch {
      // Database might not be set up yet
    }

    return NextResponse.json({
      active: activeProviders,
      discovered: discoveredProviders.slice(0, 20),
      auto_maintenance_enabled: isAutoMaintenanceEnabled(),
      last_discovery: discoveredProviders[0]?.discovered_at || null,
    });
  } catch (error: any) {
    return NextResponse.json({
      active: [
        { name: 'exolix', displayName: 'Exolix', enabled: true },
        { name: 'fixedfloat', displayName: 'FixedFloat', enabled: true },
      ],
      auto_maintenance_enabled: isAutoMaintenanceEnabled(),
      error: error.message,
    });
  }
}
