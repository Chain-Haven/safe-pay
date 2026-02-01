// SimpleSwap Provider Implementation
// API Docs: https://simpleswap.io/api
// 
// SimpleSwap offers a simple, user-friendly API for cryptocurrency
// exchanges. Requires API key.

import { PROVIDER_ENDPOINTS, SIMPLESWAP_STATUS_MAP } from '../../shared';
import type { SwapQuote, SwapDetails, SwapStatus, SupportedCoin, OrderStatus } from '../../shared';
import type { ISwapProvider, ProviderConfig } from '../interfaces';

const BASE_URL = PROVIDER_ENDPOINTS.simpleswap.base;
const DEFAULT_TIMEOUT = 30000;

/**
 * Network code mapping from our format to SimpleSwap format
 */
const NETWORK_MAP: Record<string, string> = {
  'ERC20': 'eth',
  'TRC20': 'trx',
  'BSC': 'bsc',
  'POLYGON': 'matic',
  'SOL': 'sol',
  'ARB': 'arbitrum',
  'AVAX': 'avax',
  'OP': 'optimism',
};

export class SimpleSwapProvider implements ISwapProvider {
  readonly name = 'simpleswap' as const;
  readonly displayName = 'SimpleSwap';
  readonly enabled: boolean;
  
  private timeout: number;
  private apiKey?: string;
  
  constructor(config?: ProviderConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.apiKey = config?.apiKey || process.env.SIMPLESWAP_API_KEY;
    this.enabled = !!this.apiKey;
  }
  
  /**
   * Make API request to SimpleSwap
   */
  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    // SimpleSwap uses api_key as query parameter
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
        throw new Error(`SimpleSwap API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('SimpleSwap API request timeout');
      }
      throw error;
    }
  }
  
  /**
   * Build currency symbol with network for SimpleSwap
   */
  private buildSymbol(currency: string, network: string): string {
    // SimpleSwap uses lowercase symbols, sometimes with network suffix
    const mappedNetwork = NETWORK_MAP[network] || network.toLowerCase();
    const symbol = currency.toLowerCase();
    
    // Common tokens that need network suffix
    if (['usdt', 'usdc', 'dai'].includes(symbol) && mappedNetwork !== 'eth') {
      return `${symbol}_${mappedNetwork}`;
    }
    
    return symbol;
  }
  
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any[]>('/get_all_currencies');
      
      if (!Array.isArray(response)) {
        return this.getFallbackCoins();
      }
      
      return response.map((coin: any) => ({
        code: (coin.symbol || coin.name)?.toUpperCase(),
        name: coin.name,
        networks: coin.network ? [coin.network.toUpperCase()] : ['MAINNET'],
        icon: coin.image,
      }));
    } catch (error) {
      console.error('SimpleSwap getSupportedCoins error:', error);
      return this.getFallbackCoins();
    }
  }
  
  private getFallbackCoins(): SupportedCoin[] {
    return [
      { code: 'BTC', name: 'Bitcoin', networks: ['BTC'] },
      { code: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
      { code: 'LTC', name: 'Litecoin', networks: ['LTC'] },
      { code: 'USDT', name: 'Tether', networks: ['ERC20', 'TRC20', 'BSC'] },
      { code: 'USDC', name: 'USD Coin', networks: ['ERC20', 'POLYGON'] },
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
        fixed: 'true',
        currency_from: fromSymbol,
        currency_to: toSymbol,
        amount: withdrawAmount.toString(),
      });
      
      const response = await this.request<any>(`/get_estimated?${params}`);
      
      if (!response || response.error || !response) {
        return null;
      }
      
      // SimpleSwap returns estimated amount directly
      const depositAmount = typeof response === 'string' ? parseFloat(response) : parseFloat(response.estimated_amount || response);
      
      if (isNaN(depositAmount) || depositAmount <= 0) {
        return null;
      }
      
      return {
        provider: 'simpleswap',
        depositAmount,
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount,
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: withdrawAmount / depositAmount,
        minAmount: 0,
        maxAmount: 999999,
        estimatedTime: 20,
      };
    } catch (error) {
      console.error('SimpleSwap getQuote error:', error);
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
      fixed: true,
      currency_from: fromSymbol,
      currency_to: toSymbol,
      amount: withdrawAmount,
      address_to: withdrawAddress,
    };
    
    if (withdrawMemo) {
      body.extra_id_to = withdrawMemo;
    }
    
    const response = await this.request<any>('/create_exchange', 'POST', body);
    
    if (!response || response.error || !response.address_from) {
      throw new Error(`SimpleSwap create swap failed: ${response?.message || 'Unknown error'}`);
    }
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    return {
      provider: 'simpleswap',
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
    const response = await this.request<any>(`/get_exchange?id=${swapId}`);
    
    if (!response || response.error) {
      throw new Error(`SimpleSwap status check failed: ${response?.message || 'Unknown error'}`);
    }
    
    const providerStatus = response.status?.toLowerCase() || 'unknown';
    const normalizedStatus = (SIMPLESWAP_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    return {
      provider: 'simpleswap',
      swapId,
      status: response.status,
      normalizedStatus,
      depositTxHash: response.tx_from,
      withdrawTxHash: response.tx_to,
    };
  }
}
