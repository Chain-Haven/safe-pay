// GET /api/v1/checkout/[orderId]/status
// Poll for order status updates (called by checkout page)
import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrder } from '@/lib/database';
import { rateShopper } from '@/packages/providers';
import { getTimeRemaining } from '@/packages/shared';
import type { SwapProvider } from '@/packages/shared';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const order = await getOrderById(params.orderId);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // If order is in a final state, just return current status
    if (['completed', 'failed', 'expired', 'refunded'].includes(order.status)) {
      return NextResponse.json({
        id: order.id,
        status: order.status,
        provider_status: order.provider_status,
        deposit_tx_hash: order.deposit_tx_hash,
        settlement_tx_hash: order.settlement_tx_hash,
        settlement_amount: order.settlement_amount,
      });
    }

    // Check expiration for pending orders
    if (order.status === 'pending') {
      const timeRemaining = getTimeRemaining(order.expires_at);
      if (timeRemaining.expired) {
        await updateOrder(order.id, { status: 'expired' });
        return NextResponse.json({
          id: order.id,
          status: 'expired',
        });
      }
    }

    // If swap was created, check provider status
    if (order.provider && order.provider_swap_id) {
      try {
        const providerStatus = await rateShopper.getSwapStatus(
          order.provider as SwapProvider,
          order.provider_swap_id
        );

        // Update order if status changed
        if (providerStatus.normalizedStatus !== order.status || 
            providerStatus.status !== order.provider_status) {
          
          const updates: any = {
            status: providerStatus.normalizedStatus,
            provider_status: providerStatus.status,
          };

          if (providerStatus.depositTxHash && !order.deposit_tx_hash) {
            updates.deposit_tx_hash = providerStatus.depositTxHash;
          }

          if (providerStatus.withdrawTxHash && !order.settlement_tx_hash) {
            updates.settlement_tx_hash = providerStatus.withdrawTxHash;
          }

          await updateOrder(order.id, updates);
        }

        return NextResponse.json({
          id: order.id,
          status: providerStatus.normalizedStatus,
          provider_status: providerStatus.status,
          deposit_tx_hash: providerStatus.depositTxHash || order.deposit_tx_hash,
          settlement_tx_hash: providerStatus.withdrawTxHash || order.settlement_tx_hash,
          deposit_confirmations: providerStatus.depositConfirmations,
          required_confirmations: providerStatus.requiredConfirmations,
        });
      } catch (error: any) {
        console.error('Provider status check error:', error);
        // Return cached status if provider check fails
        return NextResponse.json({
          id: order.id,
          status: order.status,
          provider_status: order.provider_status,
          deposit_tx_hash: order.deposit_tx_hash,
          settlement_tx_hash: order.settlement_tx_hash,
          error: 'Provider temporarily unavailable',
        });
      }
    }

    // Return current status for orders without swap
    return NextResponse.json({
      id: order.id,
      status: order.status,
      time_remaining: getTimeRemaining(order.expires_at),
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}
