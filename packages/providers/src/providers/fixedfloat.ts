// FixedFloat Provider Implementation
// API Docs: https://fixedfloat.com/api
// 
// FixedFloat provides a public API for cryptocurrency exchanges.
// Note: Some features may require API key for higher limits.

import { PROVIDER_ENDPOINTS, FIXEDFLOAT_STATUS_MAP } from '@safe-pay/shared';
import type { SwapQuote, SwapDetails, SwapStatus, SupportedCoin, OrderStatus } from '@safe-pay/shared';
import type { ISwapProvider, ProviderConfig } from '../interfaces';

const BASE_URL = PROVIDER_ENDPOINTS.fixedfloat.base;
const DEFAULT_TIMEOUT = 30000;

/**
 * Network code mapping from our format to FixedFloat format
 */
const NETWORK_MAP: Record<string, string> = {
  'ERC20': 'ERC20',
  'TRC20': 'TRC20',
  'BSC': 'BEP20',
  'POLYGON': 'POLYGON',
  'SOL': 'SOL',
  'ARB': 'ARBITRUM',
  'AVAX': 'AVAXC',
  'OP': 'OPTIMISM',
};

export class FixedFloatProvider implements ISwapProvider {
  readonly name = 'fixedfloat' as const;
  readonly displayName = 'FixedFloat';
  readonly enabled = true;
  
  private timeout: number;
  private apiKey?: string;
  
  constructor(config?: ProviderConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.apiKey = config?.apiKey;
  }
  
  /**
   * Make API request to FixedFloat
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
    
    // Add API key if available (increases rate limits)
    if (this.apiKey) {
      headers['X-API-KEY'] = this.apiKey;
    }
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      // FixedFloat returns errors in response body
      if (data.code !== 0 && data.code !== undefined) {
        throw new Error(`FixedFloat API error: ${data.msg || data.error || 'Unknown error'}`);
      }
      
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('FixedFloat API request timeout');
      }
      throw error;
    }
  }
  
  /**
   * Get supported currencies from FixedFloat
   */
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any>('/ccies');
      
      if (!response || !response.data) {
        return [];
      }
      
      const coins: SupportedCoin[] = [];
      
      for (const [code, info] of Object.entries(response.data) as [string, any][]) {
        if (info.recv === 1) { // Can receive this currency
          coins.push({
            code: code.toUpperCase(),
            name: info.name || code,
            networks: info.networks || [info.network || 'MAINNET'],
            icon: info.logo,
          });
        }
      }
      
      return coins;
    } catch (error) {
      console.error('FixedFloat getSupportedCoins error:', error);
      return [];
    }
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
   * Build currency code with network suffix for FixedFloat
   */
  private buildCurrencyCode(currency: string, network: string): string {
    const mappedNetwork = NETWORK_MAP[network] || network;
    // FixedFloat uses format like "USDT_ERC20" or just "BTC"
    if (mappedNetwork && mappedNetwork !== 'MAINNET') {
      return `${currency.toUpperCase()}${mappedNetwork}`;
    }
    return currency.toUpperCase();
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
      const fromCode = this.buildCurrencyCode(fromCurrency, fromNetwork);
      const toCode = this.buildCurrencyCode(toCurrency, toNetwork);
      
      const body = {
        fromCcy: fromCode,
        toCcy: toCode,
        amount: withdrawAmount,
        direction: 'to', // Fixed receive amount
        type: 'fixed',   // Fixed rate
      };
      
      const response = await this.request<any>('/price', 'POST', body);
      
      if (!response || !response.data || response.code !== 0) {
        return null;
      }
      
      const data = response.data;
      
      return {
        provider: 'fixedfloat',
        depositAmount: parseFloat(data.from.amount),
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount: parseFloat(data.to.amount),
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: parseFloat(data.rate),
        minAmount: parseFloat(data.from.min) || 0,
        maxAmount: parseFloat(data.from.max) || 999999,
        estimatedTime: 15, // FixedFloat typically takes ~15 minutes
      };
    } catch (error) {
      console.error('FixedFloat getQuote error:', error);
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
    const fromCode = this.buildCurrencyCode(fromCurrency, fromNetwork);
    const toCode = this.buildCurrencyCode(toCurrency, toNetwork);
    
    const body: any = {
      fromCcy: fromCode,
      toCcy: toCode,
      amount: withdrawAmount,
      direction: 'to',
      type: 'fixed',
      toAddress: withdrawAddress,
    };
    
    if (withdrawMemo) {
      body.toMemo = withdrawMemo;
    }
    
    const response = await this.request<any>('/create', 'POST', body);
    
    if (!response || !response.data || response.code !== 0) {
      throw new Error(`FixedFloat create swap failed: ${response?.msg || 'Unknown error'}`);
    }
    
    const data = response.data;
    
    // Calculate expiration based on response or default to 30 minutes
    const expiresIn = data.time?.left || 30 * 60;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    return {
      provider: 'fixedfloat',
      swapId: data.id,
      depositAddress: data.from.address,
      depositAmount: parseFloat(data.from.amount),
      depositCurrency: fromCurrency.toUpperCase(),
      depositNetwork: fromNetwork,
      depositMemo: data.from.tag,
      withdrawAmount: parseFloat(data.to.amount),
      withdrawAddress: withdrawAddress,
      expiresAt,
    };
  }
  
  /**
   * Get swap status
   */
  async getSwapStatus(swapId: string): Promise<SwapStatus> {
    const body = {
      id: swapId,
      token: '', // Token from creation (optional for public queries)
    };
    
    const response = await this.request<any>('/order', 'POST', body);
    
    if (!response || !response.data) {
      throw new Error(`FixedFloat status check failed: ${response?.msg || 'Unknown error'}`);
    }
    
    const data = response.data;
    
    // Map FixedFloat status to our status
    const providerStatus = data.status?.toUpperCase() || 'UNKNOWN';
    const normalizedStatus = (FIXEDFLOAT_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    return {
      provider: 'fixedfloat',
      swapId,
      status: data.status,
      normalizedStatus,
      depositTxHash: data.from?.tx?.id,
      withdrawTxHash: data.to?.tx?.id,
      depositConfirmations: data.from?.tx?.confirmations,
      requiredConfirmations: data.from?.tx?.requiredConfirmations,
    };
  }
}
