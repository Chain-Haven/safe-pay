// POST /api/v1/demo/[orderId]/swap
// Create a demo swap with real rate shopping
import { NextRequest, NextResponse } from 'next/server';
import { rateShopper } from '@/packages/providers';
import { checkRateLimit, createRateLimitKey, rateLimitResponse } from '@/lib/rate-limit';
import { demoOrders, DEMO_ADDRESSES, DEMO_MERCHANT, estimateDepositAmount } from '@/lib/demo-state';

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
        DEMO_MERCHANT.settlement_currency,
        DEMO_MERCHANT.settlement_network,
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
      deposit_memo: pay_currency.toUpperCase() === 'XRP' ? '12345678' : undefined,
      withdraw_amount: order_amount,
      expires_at: expiresAt.toISOString(),
    };

    // Update stored demo order
    const existingOrder = demoOrders.get(orderId);
    if (existingOrder) {
      demoOrders.set(orderId, {
        ...existingOrder,
        status: 'awaiting_deposit',
        pay_currency: pay_currency.toUpperCase(),
        pay_network: pay_network.toUpperCase(),
        deposit_address: depositAddress,
        deposit_amount: depositAmount,
        deposit_memo: swapResponse.deposit_memo,
        provider,
        provider_swap_id: swapResponse.swap_id,
        expires_at: expiresAt.toISOString(),
      });
    }

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
