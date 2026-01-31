// POST /api/v1/demo/create
// Create a demo checkout session for the landing page live demo
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitKey, rateLimitResponse } from '@/lib/rate-limit';
import { demoOrders, DEMO_MERCHANT, cleanupOldDemoOrders, DemoOrder } from '@/lib/demo-state';

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
    
    const demoOrder: DemoOrder = {
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

    // Clean up old demo orders
    cleanupOldDemoOrders();

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
