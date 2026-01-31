// POST /api/v1/demo/create
// Create a demo checkout session for the landing page live demo
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitKey, rateLimitResponse } from '@/lib/rate-limit';

// Demo merchant configuration
const DEMO_MERCHANT = {
  id: 'demo_merchant_001',
  store_name: 'Demo Store',
  settlement_currency: 'USDC',
  settlement_network: 'POLYGON',
  payout_address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44E', // Example address
};

// In-memory storage for demo orders (reset on serverless cold start)
const demoOrders = new Map<string, any>();

export async function POST(request: NextRequest) {
  // Rate limiting - 10 demo orders per minute per IP
  const rateLimitKey = createRateLimitKey(request, 'demo-create');
  const rateLimit = checkRateLimit(rateLimitKey, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetTime);
  }

  try {
    const body = await request.json();
    const fiatAmount = body.amount || 99.00;
    
    // Generate demo order ID
    const orderId = `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    const demoOrder = {
      id: orderId,
      merchant_id: DEMO_MERCHANT.id,
      status: 'pending',
      fiat_amount: fiatAmount,
      fiat_currency: 'USD',
      net_receive: fiatAmount,
      settlement_currency: DEMO_MERCHANT.settlement_currency,
      settlement_network: DEMO_MERCHANT.settlement_network,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://api-zeta-red.vercel.app'}/?demo=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://api-zeta-red.vercel.app'}/?demo=cancelled`,
      expires_at: expiresAt.toISOString(),
      is_demo: true,
      created_at: new Date().toISOString(),
    };

    // Store demo order
    demoOrders.set(orderId, demoOrder);

    // Clean up old demo orders (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, order] of demoOrders.entries()) {
      if (new Date(order.created_at).getTime() < oneHourAgo) {
        demoOrders.delete(id);
      }
    }

    return NextResponse.json({
      order_id: orderId,
      order: {
        ...demoOrder,
        time_remaining: {
          minutes: 30,
          seconds: 0,
          expired: false,
        },
      },
    });
  } catch (error: any) {
    console.error('Demo create error:', error);
    return NextResponse.json(
      { error: 'Failed to create demo' },
      { status: 500 }
    );
  }
}

// Export for use by other demo endpoints
export { demoOrders, DEMO_MERCHANT };
