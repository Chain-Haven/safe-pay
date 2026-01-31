// Exolix Provider Implementation
// API Docs: https://exolix.com/api
// 
// Exolix provides a fully public, no-authentication-required API
// for cryptocurrency exchanges with fixed rates.

import { PROVIDER_ENDPOINTS, EXOLIX_STATUS_MAP } from '../../shared';
import type { SwapQuote, SwapDetails, SwapStatus, SupportedCoin, OrderStatus } from '../../shared';
import type { ISwapProvider, ProviderConfig } from '../interfaces';

const BASE_URL = PROVIDER_ENDPOINTS.exolix.base;
const DEFAULT_TIMEOUT = 30000;

/**
 * Network code mapping from our format to Exolix format
 */
const NETWORK_MAP: Record<string, string> = {
  'ERC20': 'ETH',
  'TRC20': 'TRX',
  'BSC': 'BSC',
  'POLYGON': 'MATIC',
  'SOL': 'SOL',
  'ARB': 'ARBITRUM',
  'AVAX': 'AVAX',
  'OP': 'OPTIMISM',
};

/**
 * Reverse network mapping
 */
const REVERSE_NETWORK_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(NETWORK_MAP).map(([k, v]) => [v, k])
);

export class ExolixProvider implements ISwapProvider {
  readonly name = 'exolix' as const;
  readonly displayName = 'Exolix';
  readonly enabled = true;
  
  private timeout: number;
  
  constructor(config?: ProviderConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
  }
  
  /**
   * Make API request to Exolix
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Exolix API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Exolix API request timeout');
      }
      throw error;
    }
  }
  
  /**
   * Get supported currencies from Exolix
   */
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any>('/currencies');
      
      // Handle both array and object with data property
      const coins = Array.isArray(response) ? response : (response?.data || response?.currencies || []);
      
      if (!Array.isArray(coins)) {
        console.error('Exolix returned unexpected format:', typeof response);
        return this.getFallbackCoins();
      }
      
      return coins.map((coin: any) => ({
        code: coin.code || coin.symbol,
        name: coin.name,
        networks: coin.networks?.map((n: any) => REVERSE_NETWORK_MAP[n.network || n.name] || n.network || n.name) || ['MAINNET'],
        icon: coin.icon || coin.image,
      }));
    } catch (error) {
      console.error('Exolix getSupportedCoins error:', error);
      return this.getFallbackCoins();
    }
  }
  
  /**
   * Fallback list of common coins if API fails
   */
  private getFallbackCoins(): SupportedCoin[] {
    return [
      { code: 'BTC', name: 'Bitcoin', networks: ['BTC'] },
      { code: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
      { code: 'LTC', name: 'Litecoin', networks: ['LTC'] },
      { code: 'XRP', name: 'Ripple', networks: ['XRP'] },
      { code: 'DOGE', name: 'Dogecoin', networks: ['DOGE'] },
      { code: 'SOL', name: 'Solana', networks: ['SOL'] },
      { code: 'TRX', name: 'Tron', networks: ['TRC20'] },
      { code: 'BNB', name: 'BNB', networks: ['BSC'] },
      { code: 'MATIC', name: 'Polygon', networks: ['POLYGON'] },
      { code: 'AVAX', name: 'Avalanche', networks: ['AVAX'] },
      { code: 'ADA', name: 'Cardano', networks: ['ADA'] },
      { code: 'DOT', name: 'Polkadot', networks: ['DOT'] },
      { code: 'SHIB', name: 'Shiba Inu', networks: ['ERC20'] },
      { code: 'LINK', name: 'Chainlink', networks: ['ERC20'] },
      { code: 'UNI', name: 'Uniswap', networks: ['ERC20'] },
    ];
  }
  
  /**
   * Check if trading pair is supported
   */
  async isPairSupported(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string
  ): Promise<boolean> {
    try {
      const quote = await this.getQuote(fromCurrency, fromNetwork, toCurrency, toNetwork, 100);
      return quote !== null;
    } catch {
      return false;
    }
  }
  
  /**
   * Get quote for fixed withdrawal amount
   */
  async getQuote(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number
  ): Promise<SwapQuote | null> {
    try {
      const fromNet = NETWORK_MAP[fromNetwork] || fromNetwork;
      const toNet = NETWORK_MAP[toNetwork] || toNetwork;
      
      // Exolix rate endpoint with fixed withdrawal
      const params = new URLSearchParams({
        coinFrom: fromCurrency.toUpperCase(),
        networkFrom: fromNet,
        coinTo: toCurrency.toUpperCase(),
        networkTo: toNet,
        amount: withdrawAmount.toString(),
        rateType: 'fixed',
        withdrawalType: 'fixed', // Fixed withdrawal amount
      });
      
      const response = await this.request<any>(`/rate?${params}`);
      
      if (!response || response.error || !response.toAmount) {
        return null;
      }
      
      return {
        provider: 'exolix',
        depositAmount: parseFloat(response.fromAmount),
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount: parseFloat(response.toAmount),
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: parseFloat(response.rate),
        minAmount: parseFloat(response.minAmount) || 0,
        maxAmount: parseFloat(response.maxAmount) || 999999,
        estimatedTime: 10, // Exolix typically takes ~10 minutes
      };
    } catch (error) {
      console.error('Exolix getQuote error:', error);
      return null;
    }
  }
  
  /**
   * Create a swap transaction
   */
  async createSwap(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number,
    withdrawAddress: string,
    withdrawMemo?: string
  ): Promise<SwapDetails> {
    const fromNet = NETWORK_MAP[fromNetwork] || fromNetwork;
    const toNet = NETWORK_MAP[toNetwork] || toNetwork;
    
    const body: any = {
      coinFrom: fromCurrency.toUpperCase(),
      networkFrom: fromNet,
      coinTo: toCurrency.toUpperCase(),
      networkTo: toNet,
      amount: withdrawAmount,
      withdrawalType: 'fixed',
      withdrawalAddress: withdrawAddress,
      rateType: 'fixed',
    };
    
    if (withdrawMemo) {
      body.withdrawalExtraId = withdrawMemo;
    }
    
    const response = await this.request<any>('/transactions', 'POST', body);
    
    if (!response || response.error) {
      throw new Error(`Exolix create swap failed: ${response?.message || 'Unknown error'}`);
    }
    
    // Calculate expiration (Exolix swaps typically expire in 30 minutes)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    return {
      provider: 'exolix',
      swapId: response.id,
      depositAddress: response.depositAddress,
      depositAmount: parseFloat(response.amountFrom),
      depositCurrency: fromCurrency.toUpperCase(),
      depositNetwork: fromNetwork,
      depositMemo: response.depositExtraId,
      withdrawAmount: parseFloat(response.amountTo),
      withdrawAddress: withdrawAddress,
      expiresAt,
    };
  }
  
  /**
   * Get swap status
   */
  async getSwapStatus(swapId: string): Promise<SwapStatus> {
    const response = await this.request<any>(`/transactions/${swapId}`);
    
    if (!response || response.error) {
      throw new Error(`Exolix status check failed: ${response?.message || 'Unknown error'}`);
    }
    
    // Map Exolix status to our status
    const providerStatus = response.status?.toLowerCase() || 'unknown';
    const normalizedStatus = (EXOLIX_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    return {
      provider: 'exolix',
      swapId,
      status: response.status,
      normalizedStatus,
      depositTxHash: response.hashIn,
      withdrawTxHash: response.hashOut,
      depositConfirmations: response.confirmations,
      requiredConfirmations: response.confirmationsNeeded,
    };
  }
}
