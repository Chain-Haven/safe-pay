// GET /api/v1/checkout/[orderId]
// Get checkout/order details (public endpoint for checkout page)
import { NextRequest, NextResponse } from 'next/server';
import { getOrderById } from '@/lib/database';
import { getTimeRemaining } from '@/packages/shared';
import { checkRateLimit, createRateLimitKey, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  // Rate limiting
  const rateLimitKey = createRateLimitKey(request, 'checkout-status');
  const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['checkout-status']);
  
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetTime);
  }

  try {
    // Validate order ID format
    const orderId = params.orderId;
    if (!orderId || !/^ord_[a-z0-9]+$/i.test(orderId)) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    const order = await getOrderById(orderId);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check expiration
    const timeRemaining = getTimeRemaining(order.expires_at);

    // Return public order info for checkout page
    return NextResponse.json({
      id: order.id,
      status: order.status,
      fiat_amount: order.fiat_amount,
      fiat_currency: order.fiat_currency,
      net_receive: order.net_receive,
      settlement_currency: order.settlement_currency,
      
      // Payment details (if swap created)
      pay_currency: order.pay_currency,
      pay_network: order.pay_network,
      deposit_address: order.deposit_address,
      deposit_amount: order.deposit_amount,
      deposit_memo: order.deposit_memo,
      
      // Provider info
      provider: order.provider,
      provider_status: order.provider_status,
      
      // Transaction hashes
      deposit_tx_hash: order.deposit_tx_hash,
      settlement_tx_hash: order.settlement_tx_hash,
      
      // URLs
      success_url: order.success_url,
      cancel_url: order.cancel_url,
      
      // Timing
      expires_at: order.expires_at,
      time_remaining: timeRemaining,
      created_at: order.created_at,
    });
  } catch (error: any) {
    console.error('Get checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to get checkout details' },
      { status: 500 }
    );
  }
}
