// Shared state for demo orders (in-memory, resets on cold start)

export interface DemoOrder {
  id: string;
  merchant_id: string;
  status: string;
  fiat_amount: number;
  fiat_currency: string;
  net_receive: number;
  settlement_currency: string;
  settlement_network: string;
  pay_currency?: string;
  pay_network?: string;
  deposit_address?: string;
  deposit_amount?: number;
  deposit_memo?: string;
  provider?: string;
  provider_swap_id?: string;
  deposit_tx_hash?: string;
  settlement_tx_hash?: string;
  settlement_amount?: number;
  success_url: string;
  cancel_url: string;
  expires_at: string;
  is_demo: boolean;
  created_at: string;
}

// In-memory storage for demo orders
export const demoOrders = new Map<string, DemoOrder>();

// Demo merchant configuration
export const DEMO_MERCHANT = {
  id: 'demo_merchant_001',
  store_name: 'Demo Store',
  settlement_currency: 'USDC',
  settlement_network: 'POLYGON',
  payout_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
};

// Demo deposit addresses for different currencies
export const DEMO_ADDRESSES: Record<string, string> = {
  BTC: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  ETH: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  SOL: '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs',
  LTC: 'LQ3B5Y4jw8CezQRq8KqSprPzpLxVYdMvst',
  DOGE: 'D7Y55Xs2ByZBb5KYXMJKqk5kfxHqaJsJKs',
  XRP: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh',
  USDT: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  USDC: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  TRX: 'TLvG3T6EfJhwLKdsYJbHhB7y8x2KqpFmJt',
  MATIC: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  ADA: 'addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8lhrn648jjxtwq2ytjqp',
  DOT: '1FRMM8PEiWXYax7rpS6X4XZX1aAAxSWx1CrKTyrVYhV24fg',
  AVAX: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  LINK: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  SHIB: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
  DEFAULT: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E',
};

// Estimate deposit amount based on rough crypto prices
export function estimateDepositAmount(currency: string, usdAmount: number): number {
  const prices: Record<string, number> = {
    BTC: 97000,
    ETH: 3100,
    SOL: 190,
    LTC: 100,
    DOGE: 0.32,
    XRP: 2.5,
    ADA: 0.95,
    DOT: 7,
    AVAX: 35,
    LINK: 22,
    MATIC: 0.5,
    TRX: 0.23,
    SHIB: 0.000022,
    USDT: 1,
    USDC: 1,
  };

  const price = prices[currency.toUpperCase()] || 100;
  return Number((usdAmount / price).toFixed(8));
}

// Generate random hex string
export function generateRandomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Cleanup old demo orders (older than 1 hour)
export function cleanupOldDemoOrders(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [id, order] of demoOrders.entries()) {
    if (new Date(order.created_at).getTime() < oneHourAgo) {
      demoOrders.delete(id);
    }
  }
}
