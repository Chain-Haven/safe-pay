// StealthEX Provider Implementation
// API Docs: https://stealthex.io/api
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
  'ERC20': 'eth',
  'TRC20': 'trx',
  'BSC': 'bsc',
  'POLYGON': 'polygon',
  'SOL': 'sol',
  'ARB': 'arbitrum',
  'AVAX': 'avaxc',
  'OP': 'optimism',
};

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
    // StealthEX uses api_key as query parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${BASE_URL}${endpoint}${separator}api_key=${this.apiKey}`;
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
   * Build currency symbol with network for StealthEX
   */
  private buildSymbol(currency: string, network: string): string {
    const mappedNetwork = NETWORK_MAP[network] || network.toLowerCase();
    const symbol = currency.toLowerCase();
    
    // StealthEX uses format like "usdt_eth" for tokens on specific networks
    if (['usdt', 'usdc', 'dai', 'weth', 'wbtc'].includes(symbol)) {
      return `${symbol}_${mappedNetwork}`;
    }
    
    return symbol;
  }
  
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any[]>('/currencies');
      
      if (!Array.isArray(response)) {
        return this.getFallbackCoins();
      }
      
      return response.map((coin: any) => ({
        code: (coin.symbol || coin.ticker)?.toUpperCase(),
        name: coin.name,
        networks: coin.network ? [coin.network.toUpperCase()] : ['MAINNET'],
        icon: coin.image,
      }));
    } catch (error) {
      console.error('StealthEX getSupportedCoins error:', error);
      return this.getFallbackCoins();
    }
  }
  
  private getFallbackCoins(): SupportedCoin[] {
    return [
      { code: 'BTC', name: 'Bitcoin', networks: ['BTC'] },
      { code: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
      { code: 'LTC', name: 'Litecoin', networks: ['LTC'] },
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
      const fromSymbol = this.buildSymbol(fromCurrency, fromNetwork);
      const toSymbol = this.buildSymbol(toCurrency, toNetwork);
      
      const params = new URLSearchParams({
        currency_from: fromSymbol,
        currency_to: toSymbol,
        amount: withdrawAmount.toString(),
        is_fixed: 'true',
        reversed: 'true', // Fixed receive amount
      });
      
      const response = await this.request<any>(`/estimate?${params}`);
      
      if (!response || response.error || !response.estimated_amount) {
        return null;
      }
      
      return {
        provider: 'stealthex',
        depositAmount: parseFloat(response.estimated_amount),
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount,
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: withdrawAmount / parseFloat(response.estimated_amount),
        minAmount: parseFloat(response.min_amount) || 0,
        maxAmount: parseFloat(response.max_amount) || 999999,
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
    const fromSymbol = this.buildSymbol(fromCurrency, fromNetwork);
    const toSymbol = this.buildSymbol(toCurrency, toNetwork);
    
    const body: any = {
      currency_from: fromSymbol,
      currency_to: toSymbol,
      amount: withdrawAmount,
      address_to: withdrawAddress,
      fixed: true,
      reversed: true,
    };
    
    if (withdrawMemo) {
      body.extra_id_to = withdrawMemo;
    }
    
    const response = await this.request<any>('/exchange', 'POST', body);
    
    if (!response || response.error || !response.address_from) {
      throw new Error(`StealthEX create swap failed: ${response?.message || 'Unknown error'}`);
    }
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    return {
      provider: 'stealthex',
      swapId: response.id,
      depositAddress: response.address_from,
      depositAmount: parseFloat(response.amount_from || response.expected_amount),
      depositCurrency: fromCurrency.toUpperCase(),
      depositNetwork: fromNetwork,
      depositMemo: response.extra_id_from,
      withdrawAmount: parseFloat(response.amount_to),
      withdrawAddress,
      expiresAt,
    };
  }
  
  async getSwapStatus(swapId: string): Promise<SwapStatus> {
    const response = await this.request<any>(`/exchange/${swapId}`);
    
    if (!response || response.error) {
      throw new Error(`StealthEX status check failed: ${response?.message || 'Unknown error'}`);
    }
    
    const providerStatus = response.status?.toLowerCase() || 'unknown';
    const normalizedStatus = (STEALTHEX_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    return {
      provider: 'stealthex',
      swapId,
      status: response.status,
      normalizedStatus,
      depositTxHash: response.tx_from,
      withdrawTxHash: response.tx_to,
    };
  }
}
