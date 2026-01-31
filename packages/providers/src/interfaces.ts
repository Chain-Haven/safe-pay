// Provider interface definitions
// All swap providers must implement this interface

import type { 
  SwapProvider, 
  SwapQuote, 
  SwapDetails, 
  SwapStatus,
  SupportedCoin 
} from '@safe-pay/shared';

/**
 * Interface that all swap providers must implement
 * 
 * To add a new provider:
 * 1. Create a new class implementing this interface
 * 2. Place it in /providers/your-provider.ts
 * 3. Register it in registry.ts
 */
export interface ISwapProvider {
  /**
   * Unique identifier for this provider
   */
  readonly name: SwapProvider;
  
  /**
   * Display name for UI
   */
  readonly displayName: string;
  
  /**
   * Whether this provider is currently enabled
   */
  readonly enabled: boolean;
  
  /**
   * Get list of supported currencies/coins
   */
  getSupportedCoins(): Promise<SupportedCoin[]>;
  
  /**
   * Check if a specific trading pair is supported
   */
  isPairSupported(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string
  ): Promise<boolean>;
  
  /**
   * Get a quote for a fixed withdrawal amount
   * 
   * @param fromCurrency - Currency customer will send (e.g., 'BTC')
   * @param fromNetwork - Network for from currency
   * @param toCurrency - Currency merchant will receive (e.g., 'USDC')
   * @param toNetwork - Network for to currency (e.g., 'ERC20')
   * @param withdrawAmount - Fixed amount merchant should receive
   * @returns Quote with deposit amount customer needs to send
   */
  getQuote(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number
  ): Promise<SwapQuote | null>;
  
  /**
   * Create a swap/exchange transaction
   * 
   * @param fromCurrency - Currency customer will send
   * @param fromNetwork - Network for from currency  
   * @param toCurrency - Currency merchant will receive
   * @param toNetwork - Network for to currency
   * @param withdrawAmount - Fixed amount merchant should receive
   * @param withdrawAddress - Merchant's receiving address
   * @param withdrawMemo - Optional memo/tag for receiving address
   * @returns Swap details including deposit address
   */
  createSwap(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number,
    withdrawAddress: string,
    withdrawMemo?: string
  ): Promise<SwapDetails>;
  
  /**
   * Get current status of a swap
   * 
   * @param swapId - The provider's swap/transaction ID
   * @returns Current swap status
   */
  getSwapStatus(swapId: string): Promise<SwapStatus>;
}

/**
 * Configuration for provider initialization
 */
export interface ProviderConfig {
  /**
   * Optional API key (some providers work without)
   */
  apiKey?: string;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Enable test/sandbox mode
   */
  testMode?: boolean;
}

/**
 * Result of rate shopping across providers
 */
export interface RateShopResult {
  /**
   * The best quote found
   */
  bestQuote: SwapQuote;
  
  /**
   * All quotes received (for comparison)
   */
  allQuotes: SwapQuote[];
  
  /**
   * Providers that failed or returned no quote
   */
  failedProviders: { provider: SwapProvider; error: string }[];
}
