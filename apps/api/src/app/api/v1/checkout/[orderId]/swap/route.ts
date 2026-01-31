// POST /api/v1/checkout/[orderId]/swap
// Create swap after customer selects payment currency
import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, updateOrder, getMerchantById } from '@/lib/database';
import { rateShopper } from '@/packages/providers';
import { getTimeRemaining, isValidCurrencyCode } from '@/packages/shared';

interface CreateSwapBody {
  pay_currency: string;
  pay_network: string;
}

export async function POST(
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

    // Check order status
    if (order.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot create swap for order with status: ${order.status}` },
        { status: 400 }
      );
    }

    // Check expiration
    const timeRemaining = getTimeRemaining(order.expires_at);
    if (timeRemaining.expired) {
      await updateOrder(order.id, { status: 'expired' });
      return NextResponse.json(
        { error: 'Order has expired' },
        { status: 400 }
      );
    }

    // Parse request body
    const body: CreateSwapBody = await request.json();

    if (!body.pay_currency || !body.pay_network) {
      return NextResponse.json(
        { error: 'pay_currency and pay_network are required' },
        { status: 400 }
      );
    }

    if (!isValidCurrencyCode(body.pay_currency)) {
      return NextResponse.json(
        { error: 'Invalid pay_currency format' },
        { status: 400 }
      );
    }

    // Get merchant for payout address
    const merchant = await getMerchantById(order.merchant_id);
    if (!merchant) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 500 }
      );
    }

    // Rate shop to find best quote
    console.log(`[Swap] Getting best quote for ${body.pay_currency} -> ${order.settlement_currency}`);
    
    const rateShopResult = await rateShopper.getBestQuote(
      body.pay_currency.toUpperCase(),
      body.pay_network.toUpperCase(),
      order.settlement_currency,
      order.settlement_network,
      order.net_receive
    );

    if (!rateShopResult) {
      return NextResponse.json(
        { error: 'No quotes available for this trading pair' },
        { status: 400 }
      );
    }

    const bestQuote = rateShopResult.bestQuote;
    console.log(`[Swap] Best quote: ${bestQuote.provider} - ${bestQuote.depositAmount} ${body.pay_currency}`);

    // Create swap with the best provider
    const swap = await rateShopper.createSwap(
      bestQuote.provider,
      body.pay_currency.toUpperCase(),
      body.pay_network.toUpperCase(),
      order.settlement_currency,
      order.settlement_network,
      order.net_receive,
      merchant.payout_address,
      merchant.payout_memo || undefined
    );

    // Update order with swap details
    await updateOrder(order.id, {
      status: 'awaiting_deposit',
      pay_currency: body.pay_currency.toUpperCase(),
      pay_network: body.pay_network.toUpperCase(),
      deposit_address: swap.depositAddress,
      deposit_amount: swap.depositAmount,
      deposit_memo: swap.depositMemo || null,
      provider: swap.provider,
      provider_swap_id: swap.swapId,
      expires_at: swap.expiresAt,
    });

    return NextResponse.json({
      success: true,
      swap: {
        provider: swap.provider,
        swap_id: swap.swapId,
        deposit_address: swap.depositAddress,
        deposit_amount: swap.depositAmount,
        deposit_currency: swap.depositCurrency,
        deposit_network: swap.depositNetwork,
        deposit_memo: swap.depositMemo,
        withdraw_amount: swap.withdrawAmount,
        expires_at: swap.expiresAt,
      },
      all_quotes: rateShopResult.allQuotes.map(q => ({
        provider: q.provider,
        deposit_amount: q.depositAmount,
        rate: q.rate,
      })),
    });
  } catch (error: any) {
    console.error('Create swap error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create swap' },
      { status: 500 }
    );
  }
}
