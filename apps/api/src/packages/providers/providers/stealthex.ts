// StealthEX Provider Implementation
// API Docs: https://api.stealthex.io/docs
// 
// StealthEX is a privacy-focused instant cryptocurrency exchange
// with no registration required. Requires API key.

import { PROVIDER_ENDPOINTS, STEALTHEX_STATUS_MAP } from '../../shared';
import type { SwapQuote, SwapDetails, SwapStatus, SupportedCoin, OrderStatus } from '../../shared';
import type { ISwapProvider, ProviderConfig } from '../interfaces';

const BASE_URL = PROVIDER_ENDPOINTS.stealthex.base;
const DEFAULT_TIMEOUT = 30000;

/**
 * Network code mapping from our format to StealthEX format
 */
const NETWORK_MAP: Record<string, string> = {
  'ERC20': 'ethereum',
  'TRC20': 'tron',
  'BSC': 'bsc',
  'POLYGON': 'polygon',
  'SOL': 'mainnet',
  'ARB': 'arbitrum',
  'AVAX': 'avalanche',
  'OP': 'optimism',
};

const REVERSE_NETWORK_MAP: Record<string, string> = {
  ethereum: 'ERC20',
  tron: 'TRC20',
  bsc: 'BSC',
  polygon: 'POLYGON',
  arbitrum: 'ARB',
  avalanche: 'AVAX',
  optimism: 'OP',
  mainnet: 'MAINNET',
};

const MAINNET_SYMBOLS = new Set([
  'BTC',
  'ETH',
  'LTC',
  'XRP',
  'DOGE',
  'SOL',
  'ADA',
  'DOT',
]);

export class StealthExProvider implements ISwapProvider {
  readonly name = 'stealthex' as const;
  readonly displayName = 'StealthEX';
  readonly enabled: boolean;
  
  private timeout: number;
  private apiKey?: string;
  
  constructor(config?: ProviderConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.apiKey = config?.apiKey || process.env.STEALTHEX_API_KEY;
    this.enabled = !!this.apiKey;
  }
  
  /**
   * Make API request to StealthEX
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`StealthEX API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('StealthEX API request timeout');
      }
      throw error;
    }
  }
  
  /**
   * Normalize network name for StealthEX API
   */
  private normalizeNetwork(currency: string, network: string): string {
    const upperCurrency = currency.toUpperCase();
    const upperNetwork = network.toUpperCase();
    
    if (upperNetwork === 'MAINNET' || upperNetwork === upperCurrency || MAINNET_SYMBOLS.has(upperCurrency)) {
      return 'mainnet';
    }
    
    return NETWORK_MAP[upperNetwork] || network.toLowerCase();
  }
  
  /**
   * Build route object for StealthEX requests
   */
  private buildRoute(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string
  ) {
    return {
      from: {
        symbol: fromCurrency.toLowerCase(),
        network: this.normalizeNetwork(fromCurrency, fromNetwork),
      },
      to: {
        symbol: toCurrency.toLowerCase(),
        network: this.normalizeNetwork(toCurrency, toNetwork),
      },
    };
  }
  
  private async getEstimate(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number
  ) {
    const body = {
      route: this.buildRoute(fromCurrency, fromNetwork, toCurrency, toNetwork),
      amount: withdrawAmount,
      estimation: 'reversed',
      rate: 'fixed',
    };
    
    return this.request<any>(PROVIDER_ENDPOINTS.stealthex.estimate, 'POST', body);
  }
  
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any[]>(`${PROVIDER_ENDPOINTS.stealthex.currencies}?limit=250&offset=0`);
      
      if (!Array.isArray(response)) {
        return this.getFallbackCoins();
      }
      
      return response.map((coin: any) => ({
        code: coin.symbol?.toUpperCase(),
        name: coin.name,
        networks: [REVERSE_NETWORK_MAP[coin.network] || coin.network?.toUpperCase() || 'MAINNET'],
        icon: coin.icon_url,
      }));
    } catch (error) {
      console.error('StealthEX getSupportedCoins error:', error);
      return this.getFallbackCoins();
    }
  }
  
  private getFallbackCoins(): SupportedCoin[] {
    return [
      { code: 'BTC', name: 'Bitcoin', networks: ['MAINNET'] },
      { code: 'ETH', name: 'Ethereum', networks: ['MAINNET'] },
      { code: 'LTC', name: 'Litecoin', networks: ['MAINNET'] },
      { code: 'USDT', name: 'Tether', networks: ['ERC20', 'TRC20'] },
      { code: 'USDC', name: 'USD Coin', networks: ['ERC20'] },
    ];
  }
  
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
      const estimate = await this.getEstimate(
        fromCurrency,
        fromNetwork,
        toCurrency,
        toNetwork,
        withdrawAmount
      );
      
      if (!estimate || !estimate.estimated_amount) {
        return null;
      }
      
      // Optionally fetch range for min/max
      let minAmount = 0;
      let maxAmount = 999999;
      try {
        const range = await this.request<any>(PROVIDER_ENDPOINTS.stealthex.estimate.replace('estimated-amount', 'range'), 'POST', {
          route: this.buildRoute(fromCurrency, fromNetwork, toCurrency, toNetwork),
          estimation: 'reversed',
          rate: 'fixed',
        });
        if (range?.min_amount !== undefined) {
          minAmount = parseFloat(range.min_amount);
        }
        if (range?.max_amount !== undefined && range.max_amount !== null) {
          maxAmount = parseFloat(range.max_amount);
        }
      } catch {
        // Ignore range errors
      }
      
      const depositAmount = parseFloat(estimate.estimated_amount);
      
      return {
        provider: 'stealthex',
        depositAmount,
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount,
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: withdrawAmount / depositAmount,
        minAmount,
        maxAmount,
        estimatedTime: 15,
      };
    } catch (error) {
      console.error('StealthEX getQuote error:', error);
      return null;
    }
  }
  
  async createSwap(
    fromCurrency: string,
    fromNetwork: string,
    toCurrency: string,
    toNetwork: string,
    withdrawAmount: number,
    withdrawAddress: string,
    withdrawMemo?: string
  ): Promise<SwapDetails> {
    const estimate = await this.getEstimate(
      fromCurrency,
      fromNetwork,
      toCurrency,
      toNetwork,
      withdrawAmount
    );
    
    if (!estimate?.rate?.id) {
      throw new Error('StealthEX create swap failed: missing rate ID');
    }
    
    const body: any = {
      route: this.buildRoute(fromCurrency, fromNetwork, toCurrency, toNetwork),
      amount: withdrawAmount,
      estimation: 'reversed',
      rate: 'fixed',
      rate_id: estimate.rate.id,
      address: withdrawAddress,
    };
    
    if (withdrawMemo) {
      body.extra_id = withdrawMemo;
    }
    
    const response = await this.request<any>(PROVIDER_ENDPOINTS.stealthex.exchange, 'POST', body);
    
    if (!response?.deposit?.address) {
      throw new Error('StealthEX create swap failed: missing deposit address');
    }
    
    const expiresAt = response.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    return {
      provider: 'stealthex',
      swapId: response.id,
      depositAddress: response.deposit.address,
      depositAmount: parseFloat(response.deposit.expected_amount),
      depositCurrency: fromCurrency.toUpperCase(),
      depositNetwork: fromNetwork,
      depositMemo: response.deposit.extra_id || undefined,
      withdrawAmount: parseFloat(response.withdrawal.expected_amount),
      withdrawAddress,
      expiresAt,
    };
  }
  
  async getSwapStatus(swapId: string): Promise<SwapStatus> {
    const response = await this.request<any>(`${PROVIDER_ENDPOINTS.stealthex.status}/${swapId}`);
    
    if (!response?.status) {
      throw new Error('StealthEX status check failed');
    }
    
    const providerStatus = response.status?.toLowerCase() || 'unknown';
    const normalizedStatus = (STEALTHEX_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    return {
      provider: 'stealthex',
      swapId,
      status: response.status,
      normalizedStatus,
      depositTxHash: response.deposit?.tx_hash || undefined,
      withdrawTxHash: response.withdrawal?.tx_hash || undefined,
    };
  }
}
