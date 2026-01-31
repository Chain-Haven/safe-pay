// GET /api/v1/demo/[orderId]
// Get demo order details
import { NextRequest, NextResponse } from 'next/server';
import { demoOrders } from '@/lib/demo-state';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    
    // Validate demo order ID format
    if (!orderId.startsWith('demo_')) {
      return NextResponse.json(
        { error: 'Invalid demo order ID' },
        { status: 400 }
      );
    }

    const order = demoOrders.get(orderId);
    
    if (!order) {
      // Return a default pending demo order if not found
      const defaultOrder = {
        id: orderId,
        status: 'pending',
        fiat_amount: 99.00,
        fiat_currency: 'USD',
        net_receive: 99.00,
        settlement_currency: 'USDC',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://api-zeta-red.vercel.app'}/?demo=success`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://api-zeta-red.vercel.app'}/?demo=cancelled`,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        time_remaining: { minutes: 30, seconds: 0, expired: false },
        is_demo: true,
      };
      return NextResponse.json(defaultOrder);
    }

    // Calculate time remaining
    const expiresAt = new Date(order.expires_at);
    const now = new Date();
    const remaining = Math.max(0, expiresAt.getTime() - now.getTime());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return NextResponse.json({
      ...order,
      time_remaining: {
        minutes,
        seconds,
        expired: remaining <= 0,
      },
    });
  } catch (error: any) {
    console.error('Get demo order error:', error);
    return NextResponse.json(
      { error: 'Failed to get demo order' },
      { status: 500 }
    );
  }
}
