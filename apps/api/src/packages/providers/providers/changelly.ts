// Changelly Provider Implementation
// API Docs: https://api-docs.changelly.com
// 
// Changelly is one of the most established cryptocurrency exchange
// services. Requires API key and secret for authentication.

import { PROVIDER_ENDPOINTS, CHANGELLY_STATUS_MAP } from '../../shared';
import type { SwapQuote, SwapDetails, SwapStatus, SupportedCoin, OrderStatus } from '../../shared';
import type { ISwapProvider, ProviderConfig } from '../interfaces';
import * as crypto from 'crypto';

const BASE_URL = PROVIDER_ENDPOINTS.changelly.base;
const DEFAULT_TIMEOUT = 30000;

/**
 * Network code mapping from our format to Changelly format
 */
const NETWORK_MAP: Record<string, string> = {
  'ERC20': 'ethereum',
  'TRC20': 'tron',
  'BSC': 'bsc',
  'POLYGON': 'polygon',
  'SOL': 'solana',
  'ARB': 'arbitrum',
  'AVAX': 'avalanche',
  'OP': 'optimism',
};

export class ChangellyProvider implements ISwapProvider {
  readonly name = 'changelly' as const;
  readonly displayName = 'Changelly';
  readonly enabled: boolean;
  
  private timeout: number;
  private apiKey?: string;
  private apiSecret?: string;
  
  constructor(config?: ProviderConfig) {
    this.timeout = config?.timeout ?? DEFAULT_TIMEOUT;
    this.apiKey = config?.apiKey || process.env.CHANGELLY_API_KEY;
    this.apiSecret = process.env.CHANGELLY_API_SECRET;
    this.enabled = !!(this.apiKey && this.apiSecret);
  }
  
  /**
   * Generate HMAC signature for Changelly API
   */
  private generateSignature(message: string): string {
    if (!this.apiSecret) return '';
    return crypto.createHmac('sha512', this.apiSecret).update(message).digest('hex');
  }
  
  /**
   * Make API request to Changelly
   */
  private async request<T>(
    method: string,
    params: any = {}
  ): Promise<T> {
    const id = Date.now().toString();
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    });
    
    const sign = this.generateSignature(body);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey || '',
          'sign': sign,
        },
        body,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Changelly API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(`Changelly API error: ${data.error.message || data.error}`);
      }
      
      return data.result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Changelly API request timeout');
      }
      throw error;
    }
  }
  
  /**
   * Build currency ticker for Changelly
   */
  private buildTicker(currency: string, network: string): string {
    const mappedNetwork = NETWORK_MAP[network] || network.toLowerCase();
    const ticker = currency.toLowerCase();
    
    // Changelly uses format like "usdterc20" for tokens
    if (['usdt', 'usdc', 'dai'].includes(ticker)) {
      if (mappedNetwork === 'ethereum') return `${ticker}erc20`;
      if (mappedNetwork === 'tron') return `${ticker}trc20`;
      if (mappedNetwork === 'bsc') return `${ticker}bep20`;
      if (mappedNetwork === 'polygon') return `${ticker}polygon`;
    }
    
    return ticker;
  }
  
  async getSupportedCoins(): Promise<SupportedCoin[]> {
    try {
      const response = await this.request<any[]>('getCurrenciesFull');
      
      if (!Array.isArray(response)) {
        return this.getFallbackCoins();
      }
      
      return response
        .filter((coin: any) => coin.enabled)
        .map((coin: any) => ({
          code: coin.ticker?.toUpperCase() || coin.name?.toUpperCase(),
          name: coin.fullName || coin.name,
          networks: coin.blockchain ? [coin.blockchain.toUpperCase()] : ['MAINNET'],
          icon: coin.image,
        }));
    } catch (error) {
      console.error('Changelly getSupportedCoins error:', error);
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
      const fromTicker = this.buildTicker(fromCurrency, fromNetwork);
      const toTicker = this.buildTicker(toCurrency, toNetwork);
      
      // Use getFixRateForAmount for fixed-rate swaps with reverse calculation
      const response = await this.request<any>('getFixRateForAmount', {
        from: fromTicker,
        to: toTicker,
        amountTo: withdrawAmount,
      });
      
      if (!response || response.error || !response.amountFrom) {
        return null;
      }
      
      return {
        provider: 'changelly',
        depositAmount: parseFloat(response.amountFrom),
        depositCurrency: fromCurrency.toUpperCase(),
        depositNetwork: fromNetwork,
        withdrawAmount,
        withdrawCurrency: toCurrency.toUpperCase(),
        withdrawNetwork: toNetwork,
        rate: withdrawAmount / parseFloat(response.amountFrom),
        minAmount: parseFloat(response.minFrom) || 0,
        maxAmount: parseFloat(response.maxFrom) || 999999,
        estimatedTime: 15,
      };
    } catch (error) {
      console.error('Changelly getQuote error:', error);
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
    const fromTicker = this.buildTicker(fromCurrency, fromNetwork);
    const toTicker = this.buildTicker(toCurrency, toNetwork);
    
    // First get the rate ID for fixed-rate swap
    const rateResponse = await this.request<any>('getFixRateForAmount', {
      from: fromTicker,
      to: toTicker,
      amountTo: withdrawAmount,
    });
    
    if (!rateResponse || !rateResponse.id) {
      throw new Error('Changelly: Failed to get rate');
    }
    
    // Create the fixed-rate transaction
    const params: any = {
      from: fromTicker,
      to: toTicker,
      address: withdrawAddress,
      amountTo: withdrawAmount,
      rateId: rateResponse.id,
    };
    
    if (withdrawMemo) {
      params.extraId = withdrawMemo;
    }
    
    const response = await this.request<any>('createFixTransaction', params);
    
    if (!response || response.error || !response.payinAddress) {
      throw new Error(`Changelly create swap failed: ${response?.message || 'Unknown error'}`);
    }
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    
    return {
      provider: 'changelly',
      swapId: response.id,
      depositAddress: response.payinAddress,
      depositAmount: parseFloat(response.amountExpectedFrom),
      depositCurrency: fromCurrency.toUpperCase(),
      depositNetwork: fromNetwork,
      depositMemo: response.payinExtraId,
      withdrawAmount: parseFloat(response.amountExpectedTo),
      withdrawAddress,
      expiresAt,
    };
  }
  
  async getSwapStatus(swapId: string): Promise<SwapStatus> {
    const response = await this.request<any>('getStatus', { id: swapId });
    
    if (!response) {
      throw new Error('Changelly status check failed');
    }
    
    // Response is just the status string
    const providerStatus = (typeof response === 'string' ? response : response.status)?.toLowerCase() || 'unknown';
    const normalizedStatus = (CHANGELLY_STATUS_MAP[providerStatus] || 'pending') as OrderStatus;
    
    // Get full transaction details for hashes
    let txDetails: any = null;
    try {
      const transactions = await this.request<any[]>('getTransactions', { id: swapId });
      txDetails = transactions?.[0];
    } catch {
      // Ignore errors getting full details
    }
    
    return {
      provider: 'changelly',
      swapId,
      status: providerStatus,
      normalizedStatus,
      depositTxHash: txDetails?.payinHash,
      withdrawTxHash: txDetails?.payoutHash,
    };
  }
}
