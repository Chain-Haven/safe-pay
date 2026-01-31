// Provider Registry
// 
// Central registry for all swap providers. New providers should be
// registered here to be included in rate shopping.
// 
// HOW TO ADD A NEW PROVIDER:
// 1. Create a new class in /providers/ implementing ISwapProvider
// 2. Import it here
// 3. Add it to the registerDefaultProviders() function
// 4. The rate shopper will automatically include it

import type { SwapProvider } from '../shared';
import type { ISwapProvider, ProviderConfig } from './interfaces';
import { ExolixProvider } from './providers/exolix';
import { FixedFloatProvider } from './providers/fixedfloat';

/**
 * Provider registry singleton
 */
class ProviderRegistry {
  private providers: Map<SwapProvider, ISwapProvider> = new Map();
  private initialized = false;
  
  /**
   * Register a provider
   */
  register(provider: ISwapProvider): void {
    this.providers.set(provider.name, provider);
    console.log(`[ProviderRegistry] Registered provider: ${provider.displayName}`);
  }
  
  /**
   * Unregister a provider
   */
  unregister(name: SwapProvider): void {
    this.providers.delete(name);
    console.log(`[ProviderRegistry] Unregistered provider: ${name}`);
  }
  
  /**
   * Get a provider by name
   */
  get(name: SwapProvider): ISwapProvider | undefined {
    return this.providers.get(name);
  }
  
  /**
   * Get all registered providers
   */
  getAll(): ISwapProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Get all enabled providers
   */
  getEnabled(): ISwapProvider[] {
    return this.getAll().filter(p => p.enabled);
  }
  
  /**
   * Check if a provider is registered
   */
  has(name: SwapProvider): boolean {
    return this.providers.has(name);
  }
  
  /**
   * Initialize with default providers
   */
  initializeDefaults(config?: ProviderConfig): void {
    if (this.initialized) {
      return;
    }
    
    // Register Exolix (primary - no API key required)
    this.register(new ExolixProvider(config));
    
    // Register FixedFloat (secondary - works without API key)
    this.register(new FixedFloatProvider(config));
    
    // Future providers can be added here:
    // this.register(new ChangeNowProvider(config)); // Requires API key
    // this.register(new SimpleSwapProvider(config)); // Requires API key
    
    this.initialized = true;
    console.log(`[ProviderRegistry] Initialized with ${this.providers.size} providers`);
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();

/**
 * Helper function to add a new provider at runtime
 * 
 * @example
 * // Add a new provider class
 * addNewProvider(new MyNewProvider());
 */
export function addNewProvider(provider: ISwapProvider): void {
  providerRegistry.register(provider);
}

/**
 * PLACEHOLDER: Function to dynamically add a provider from configuration
 * 
 * This is a stub for future AI-assisted provider generation.
 * When implementing:
 * 1. Parse the provider configuration
 * 2. Validate required methods
 * 3. Create provider instance
 * 4. Register with registry
 * 
 * Future: Integrate with Grok/Claude API to auto-generate provider classes
 */
export function addProviderFromConfig(config: {
  name: string;
  displayName: string;
  baseUrl: string;
  endpoints: {
    currencies?: string;
    rate: string;
    create: string;
    status: string;
  };
  // Future: Include schema for request/response mapping
}): void {
  console.log(`[ProviderRegistry] addProviderFromConfig called with:`, config);
  console.log(`[ProviderRegistry] This is a placeholder - manual implementation required`);
  
  // TODO: Future implementation with AI code generation
  // 1. Use Claude/Grok API to analyze the provider's API documentation
  // 2. Generate TypeScript class implementing ISwapProvider
  // 3. Compile and register dynamically
  // 4. Create PR to GitHub for human review
}

/**
 * Initialize the registry on import
 */
export function initializeProviders(config?: ProviderConfig): void {
  providerRegistry.initializeDefaults(config);
}
