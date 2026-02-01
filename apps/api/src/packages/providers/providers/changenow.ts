// ChangeNOW Provider Implementation
// API Docs: https://changenow.io/api/docs
// 
// ChangeNOW is a popular non-custodial exchange service with
// a well-documented API. Requires API key for full functionality.

import { PROVIDER_ENDPOINTS, CHANGENOW_STATUS_MAP } from '../../shared';
import type { SwapQuote, SwapDetails, SwapStatus, SupportedCoin, OrderStatus } from '../../shared';
import type { ISwapProvider, ProviderConfig } from '../interfaces';

const BASE_URL = PROVIDER_ENDPOINTS.changenow.base;
const DEFAULT_TIMEOUT = 30000;

/**
 * Network code mapping from our format to ChangeNOW format
 */
const NETWORK_MAP: Record<string, string> = {
  'ERC20': 'eth',
  'TRC20': 'trx',
  'BSC': 'bsc',
  'POLYGON': 'matic',
  'SOL': 'sol',
  'ARB': 'arbitrum',
  'AVAX': 'avaxc',
  'OP': 'optimism',
};

export class ChangeNowProvider implements ISwapProvider {
  readonly name = 'changenow' as const;
  readonly displayName = 'ChangeNOW';
  readonly enabled: boolean;
  
  private timeout: number;
  private apiKey?: string;
  
  constructor(config?: ProviderConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.apiKey = config?.apiKey || process.env.CHANGENOW_API_KEY;
    // Enable only if API key is available
    this.enabled = !!this.apiKey;
  }
  
  /**
   * Make API request to ChangeNOW
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
      headers['x-changenow-api-key'] = this.apiKey;
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
        throw new Error(`ChangeNOW API error: ${response.status} - ${error}`);
      }
      
      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('ChangeNOW API request timeout');
      }
      throw error;
    }
  }
  
  /**
   * Build currency ticker with network for ChangeNOW
   */
  private buildTicker(currency: string, network: string): string {
    const mappedNetwork = NETWORK_MAP[network] || network.toLowerCase();
    // ChangeNOW uses format like "usdterc20" or just "btc"
    if (mappedNetwork && !['btc', 'ltc', 'doge', 'xrp', 'ada', 'dot'].includes(currency.toLowerCase())) {
      return `${currency.toLowerCase()}${mappedNetwork}`;
    }
    return currency.toLowerCase();
  }
  
  /**
   * Get supported currencies
   */
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any[]>('/exchange/currencies?active=true');
      
      if (!Array.isArray(response)) {
        return this.getFallbackCoins();
      }
      
      return response.map((coin: any) => ({
        code: coin.ticker?.toUpperCase() || coin.legacyTicker?.toUpperCase(),
        name: coin.name,
        networks: coin.network ? [coin.network.toUpperCase()] : ['MAINNET'],
        icon: coin.image,
      }));
    } catch (error) {
      console.error('ChangeNOW getSupportedCoins error:', error);
      return this.getFallbackCoins();
    }
  }
  
  private getFallbackCoins(): SupportedCoin[] {
    return [
      { code: 'BTC', name: 'Bitcoin', networks: ['BTC'] },
      { code: 'ETH', name: 'Ethereum', networks: ['ERC20'] },
      { code: 'LTC', name: 'Litecoin', networks: ['LTC'] },
      { code: 'USDT', name: 'Tether', networks: ['ERC20', 'TRC20', 'BSC', 'POLYGON'] },
      { code: 'USDC', name: 'USD Coin', networks: ['ERC20', 'POLYGON', 'ARB'] },
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
      const fromTicker = this.buildTicker(fromCurrency, fromNetwork);
      const toTicker = this.buildTicker(toCurrency, toNetwork);
      
      // ChangeNOW estimate endpoint
      const params = new URLSearchParams({
        fromCurrency: fromTicker,
        toCurrency: toTicker,
        toAmount: withdrawAmount.toString(),
        flow: 'fixed-rate',
        type: 'reverse', // Fixed receive amount
      });
      
      const response = await this.request<any>(`/exchange/estimated-amount?${params}`);
      
      if (!response || response.error || !response.fromAmount) {
        return null;
      }
      
      return {
        provider: 'changenow',
        depositAmount: parseFloat(response.fromAmount),
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount: withdrawAmount,
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: withdrawAmount / parseFloat(response.fromAmount),
        minAmount: parseFloat(response.minAmount) || 0,
        maxAmount: parseFloat(response.maxAmount) || 999999,
        estimatedTime: 15,
      };
    } catch (error) {
      console.error('ChangeNOW getQuote error:', error);
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
    const fromTicker = this.buildTicker(fromCurrency, fromNetwork);
    const toTicker = this.buildTicker(toCurrency, toNetwork);
    
    const body: any = {
      fromCurrency: fromTicker,
      toCurrency: toTicker,
      toAmount: withdrawAmount,
      address: withdrawAddress,
      flow: 'fixed-rate',
      type: 'reverse',
    };
    
    if (withdrawMemo) {
      body.extraId = withdrawMemo;
    }
    
    const response = await this.request<any>('/exchange', 'POST', body);
    
    if (!response || response.error || !response.payinAddress) {
      throw new Error(`ChangeNOW create swap failed: ${response?.message || 'Unknown error'}`);
    }
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    return {
      provider: 'changenow',
      swapId: response.id,
      depositAddress: response.payinAddress,
      depositAmount: parseFloat(response.fromAmount || response.expectedAmountFrom),
      depositCurrency: fromCurrency.toUpperCase(),
      depositNetwork: fromNetwork,
      depositMemo: response.payinExtraId,
      withdrawAmount: parseFloat(response.toAmount || response.expectedAmountTo),
      withdrawAddress: withdrawAddress,
      expiresAt,
    };
  }
  
  /**
   * Get swap status
   */
  async getSwapStatus(swapId: string): Promise<SwapStatus> {
    const response = await this.request<any>(`/exchange/by-id?id=${swapId}`);
    
    if (!response || response.error) {
      throw new Error(`ChangeNOW status check failed: ${response?.message || 'Unknown error'}`);
    }
    
    const providerStatus = response.status?.toLowerCase() || 'unknown';
    const normalizedStatus = (CHANGENOW_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    return {
      provider: 'changenow',
      swapId,
      status: response.status,
      normalizedStatus,
      depositTxHash: response.payinHash,
      withdrawTxHash: response.payoutHash,
    };
  }
}
