// Rate Shopper
// 
// Queries all enabled providers in parallel and returns the best rate
// (lowest deposit amount for a fixed withdrawal amount)

import type { SwapQuote, SwapDetails, SwapProvider } from '../shared';
import type { ISwapProvider, RateShopResult } from './interfaces';
import { providerRegistry, initializeProviders } from './registry';

/**
 * Rate Shopper class
 * 
 * Handles querying multiple providers and selecting the best rate
 */
export class RateShopper {
  /**
   * Get quotes from all enabled providers and return the best one
   */
  async getBestQuote(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number
  ): Promise<RateShopResult | null> {
    // Ensure providers are initialized
    initializeProviders();
    
    const providers = providerRegistry.getEnabled();
    
    if (providers.length === 0) {
      throw new Error('No providers available');
    }
    
    console.log(`[RateShopper] Getting quotes from ${providers.length} providers...`);
    
    // Query all providers in parallel
    const quotePromises = providers.map(async (provider) => {
      try {
        const quote = await provider.getQuote(
          fromCurrency,
          fromNetwork,
          toCurrency,
          toNetwork,
          withdrawAmount
        );
        
        if (quote) {
          console.log(`[RateShopper] ${provider.displayName}: ${quote.depositAmount} ${fromCurrency}`);
        } else {
          console.log(`[RateShopper] ${provider.displayName}: No quote available`);
        }
        
        return { provider: provider.name, quote, error: null };
      } catch (error: any) {
        console.error(`[RateShopper] ${provider.displayName} error:`, error.message);
        return { provider: provider.name, quote: null, error: error.message };
      }
    });
    
    const results = await Promise.all(quotePromises);
    
    // Separate successful quotes from failures
    const successfulQuotes: SwapQuote[] = [];
    const failedProviders: { provider: SwapProvider; error: string }[] = [];
    
    for (const result of results) {
      if (result.quote) {
        successfulQuotes.push(result.quote);
      } else {
        failedProviders.push({
          provider: result.provider,
          error: result.error || 'No quote available',
        });
      }
    }
    
    if (successfulQuotes.length === 0) {
      console.log('[RateShopper] No quotes available from any provider');
      return null;
    }
    
    // Find the best quote (lowest deposit amount)
    const bestQuote = successfulQuotes.reduce((best, current) => {
      return current.depositAmount < best.depositAmount ? current : best;
    });
    
    console.log(`[RateShopper] Best quote: ${bestQuote.provider} - ${bestQuote.depositAmount} ${fromCurrency}`);
    
    return {
      bestQuote,
      allQuotes: successfulQuotes,
      failedProviders,
    };
  }
  
  /**
   * Create a swap using the specified provider
   */
  async createSwap(
    provider: SwapProvider,
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number,
    withdrawAddress: string,
    withdrawMemo?: string
  ): Promise<SwapDetails> {
    // Ensure providers are initialized
    initializeProviders();
    
    const providerInstance = providerRegistry.get(provider);
    
    if (!providerInstance) {
      throw new Error(`Provider not found: ${provider}`);
    }
    
    console.log(`[RateShopper] Creating swap with ${providerInstance.displayName}...`);
    
    const swap = await providerInstance.createSwap(
      fromCurrency,
      fromNetwork,
      toCurrency,
      toNetwork,
      withdrawAmount,
      withdrawAddress,
      withdrawMemo
    );
    
    console.log(`[RateShopper] Swap created: ${swap.swapId}`);
    
    return swap;
  }
  
  /**
   * Get swap status from the appropriate provider
   */
  async getSwapStatus(provider: SwapProvider, swapId: string) {
    // Ensure providers are initialized
    initializeProviders();
    
    const providerInstance = providerRegistry.get(provider);
    
    if (!providerInstance) {
      throw new Error(`Provider not found: ${provider}`);
    }
    
    return providerInstance.getSwapStatus(swapId);
  }
  
  /**
   * Get all supported coins (merged from all providers)
   */
  async getAllSupportedCoins() {
    // Ensure providers are initialized
    initializeProviders();
    
    const providers = providerRegistry.getEnabled();
    
    // Query all providers in parallel
    const coinPromises = providers.map(async (provider) => {
      try {
        return await provider.getSupportedCoins();
      } catch {
        return [];
      }
    });
    
    const results = await Promise.all(coinPromises);
    
    // Merge and deduplicate coins
    const coinMap = new Map<string, { code: string; name: string; networks: Set<string>; icon?: string }>();
    
    for (const coins of results) {
      for (const coin of coins) {
        const existing = coinMap.get(coin.code);
        if (existing) {
          // Merge networks
          coin.networks.forEach(n => existing.networks.add(n));
        } else {
          coinMap.set(coin.code, {
            ...coin,
            networks: new Set(coin.networks),
          });
        }
      }
    }
    
    // Convert back to array format
    return Array.from(coinMap.values()).map(coin => ({
      ...coin,
      networks: Array.from(coin.networks),
    }));
  }
}

// Export singleton instance
export const rateShopper = new RateShopper();
