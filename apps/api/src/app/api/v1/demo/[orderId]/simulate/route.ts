// POST /api/v1/demo/[orderId]/simulate
// Simulate payment for demo orders - progresses through status stages
import { NextRequest, NextResponse } from 'next/server';
import { demoOrders, generateRandomHex } from '@/lib/demo-state';

export async function POST(
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

    const body = await request.json();
    const { action } = body; // 'pay' | 'confirm' | 'exchange' | 'complete' | 'auto'

    let order = demoOrders.get(orderId);
    
    if (!order) {
      return NextResponse.json(
        { error: 'Demo order not found' },
        { status: 404 }
      );
    }

    // Progress through states based on action
    switch (action) {
      case 'pay':
        order = {
          ...order,
          status: 'confirming',
          deposit_tx_hash: `0x${generateRandomHex(64)}`,
        };
        break;

      case 'confirm':
        order = {
          ...order,
          status: 'exchanging',
        };
        break;

      case 'exchange':
        order = {
          ...order,
          status: 'sending',
        };
        break;

      case 'complete':
        order = {
          ...order,
          status: 'completed',
          settlement_tx_hash: `0x${generateRandomHex(64)}`,
          settlement_amount: order.net_receive,
        };
        break;

      case 'auto':
        // Auto-progress through all states with delays handled client-side
        if (order.status === 'awaiting_deposit') {
          order = { ...order, status: 'confirming', deposit_tx_hash: `0x${generateRandomHex(64)}` };
        } else if (order.status === 'confirming') {
          order = { ...order, status: 'exchanging' };
        } else if (order.status === 'exchanging') {
          order = { ...order, status: 'sending' };
        } else if (order.status === 'sending') {
          order = { ...order, status: 'completed', settlement_tx_hash: `0x${generateRandomHex(64)}`, settlement_amount: order.net_receive };
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update stored order
    demoOrders.set(orderId, order);

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: order.status,
        deposit_tx_hash: order.deposit_tx_hash,
        settlement_tx_hash: order.settlement_tx_hash,
        settlement_amount: order.settlement_amount,
      },
    });
  } catch (error: any) {
    console.error('Demo simulate error:', error);
    return NextResponse.json(
      { error: 'Failed to simulate payment' },
      { status: 500 }
    );
  }
}
