// POST /api/v1/demo/[orderId]/swap
// Create a demo swap with real rate shopping
import { NextRequest, NextResponse } from 'next/server';
import { rateShopper } from '@/packages/providers';
import { checkRateLimit, createRateLimitKey, rateLimitResponse } from '@/lib/rate-limit';

// In-memory demo orders storage
const demoOrders = new Map<string, any>();

// Demo deposit addresses for different currencies
const DEMO_ADDRESSES: Record<string, string> = {
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

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  // Rate limiting
  const rateLimitKey = createRateLimitKey(request, 'demo-swap');
  const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60000, maxRequests: 20 });
  
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetTime);
  }

  try {
    const { orderId } = params;
    
    // Validate demo order ID format
    if (!orderId.startsWith('demo_')) {
      return NextResponse.json(
        { error: 'Invalid demo order ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { pay_currency, pay_network, order_amount = 99 } = body;

    if (!pay_currency || !pay_network) {
      return NextResponse.json(
        { error: 'pay_currency and pay_network are required' },
        { status: 400 }
      );
    }

    // Try to get real quotes from rate shopper
    let depositAmount: number;
    let provider = 'demo';
    let allQuotes: any[] = [];

    try {
      const rateShopResult = await rateShopper.getBestQuote(
        pay_currency.toUpperCase(),
        pay_network.toUpperCase(),
        'USDC',
        'POLYGON',
        order_amount
      );

      if (rateShopResult && rateShopResult.bestQuote) {
        depositAmount = rateShopResult.bestQuote.depositAmount;
        provider = rateShopResult.bestQuote.provider;
        allQuotes = rateShopResult.allQuotes.map(q => ({
          provider: q.provider,
          deposit_amount: q.depositAmount,
          rate: q.rate,
        }));
      } else {
        // Fallback to estimated amount
        depositAmount = estimateDepositAmount(pay_currency, order_amount);
      }
    } catch (error) {
      console.log('Rate shop failed for demo, using estimate');
      depositAmount = estimateDepositAmount(pay_currency, order_amount);
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const depositAddress = DEMO_ADDRESSES[pay_currency.toUpperCase()] || DEMO_ADDRESSES.DEFAULT;

    // Create demo swap response
    const swapResponse = {
      provider,
      swap_id: `demo_swap_${Date.now()}`,
      deposit_address: depositAddress,
      deposit_amount: depositAmount,
      deposit_currency: pay_currency.toUpperCase(),
      deposit_network: pay_network.toUpperCase(),
      deposit_memo: pay_currency === 'XRP' ? '12345678' : undefined,
      withdraw_amount: order_amount,
      expires_at: expiresAt.toISOString(),
    };

    // Store updated demo order
    demoOrders.set(orderId, {
      id: orderId,
      status: 'awaiting_deposit',
      fiat_amount: order_amount,
      fiat_currency: 'USD',
      net_receive: order_amount,
      settlement_currency: 'USDC',
      pay_currency: pay_currency.toUpperCase(),
      pay_network: pay_network.toUpperCase(),
      deposit_address: depositAddress,
      deposit_amount: depositAmount,
      deposit_memo: swapResponse.deposit_memo,
      provider,
      provider_swap_id: swapResponse.swap_id,
      expires_at: expiresAt.toISOString(),
      is_demo: true,
      time_remaining: { minutes: 30, seconds: 0, expired: false },
    });

    return NextResponse.json({
      success: true,
      swap: swapResponse,
      all_quotes: allQuotes.length > 0 ? allQuotes : [
        { provider, deposit_amount: depositAmount, rate: order_amount / depositAmount },
      ],
    });
  } catch (error: any) {
    console.error('Demo swap error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create demo swap' },
      { status: 500 }
    );
  }
}

// Estimate deposit amount based on rough crypto prices
function estimateDepositAmount(currency: string, usdAmount: number): number {
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

// Get demo order
export { demoOrders };
