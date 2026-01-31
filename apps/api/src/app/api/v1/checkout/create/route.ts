// POST /api/v1/checkout/create
// Create a new checkout session for an order
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/auth';
import { createOrder, getIdempotencyKey, saveIdempotencyKey } from '@/lib/database';
import { checkRateLimit, createRateLimitKey, RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit';
import {
  calculateNetReceive,
  isValidFiatAmount,
  isValidExternalOrderId,
  isValidUrl,
  generateCheckoutUrl,
  validateRequiredFields,
} from '@/packages/shared';
import type { CreateCheckoutRequest, CreateCheckoutResponse } from '@/packages/shared';

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitKey = createRateLimitKey(request, 'checkout-create');
  const rateLimit = checkRateLimit(rateLimitKey, RATE_LIMITS['checkout-create']);
  
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetTime);
  }
  // Verify authentication
  const auth = await verifyRequest(request);
  if (!auth.success || !auth.merchant) {
    return NextResponse.json(
      { error: auth.error || 'Authentication failed' },
      { status: 401 }
    );
  }

  const merchant = auth.merchant;

  try {
    // Body was consumed during auth verification, use the returned body
    const body = JSON.parse(auth.body || '{}');

    // Check idempotency key
    const idempotencyKey = request.headers.get('X-Idempotency-Key');
    if (idempotencyKey) {
      const existing = await getIdempotencyKey(idempotencyKey, merchant.id);
      if (existing) {
        return NextResponse.json(existing.response);
      }
    }

    // Validate required fields
    if (!validateRequiredFields<CreateCheckoutRequest>(body, [
      'external_order_id',
      'fiat_amount',
      'fiat_currency',
      'success_url',
      'cancel_url',
    ])) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const {
      external_order_id,
      fiat_amount,
      fiat_currency,
      success_url,
      cancel_url,
      metadata,
    } = body as CreateCheckoutRequest;

    // Validate external order ID
    if (!isValidExternalOrderId(external_order_id)) {
      return NextResponse.json(
        { error: 'Invalid external order ID format' },
        { status: 400 }
      );
    }

    // Validate fiat amount
    if (!isValidFiatAmount(fiat_amount)) {
      return NextResponse.json(
        { error: 'Invalid fiat amount. Must be positive and up to 2 decimal places.' },
        { status: 400 }
      );
    }

    // Validate URLs
    if (!isValidUrl(success_url) || !isValidUrl(cancel_url)) {
      return NextResponse.json(
        { error: 'Invalid success_url or cancel_url' },
        { status: 400 }
      );
    }

    // Calculate receive amounts
    // For simplicity, we assume 1 USD = 1 USDC/USDT (market rate)
    // In production, you'd fetch live stablecoin rates
    const grossReceive = fiat_amount; // Assuming 1:1 for stablecoins
    const netReceive = calculateNetReceive(grossReceive); // Apply 1% fee

    // Create order
    const order = await createOrder({
      merchantId: merchant.id,
      externalOrderId: external_order_id,
      fiatAmount: fiat_amount,
      fiatCurrency: fiat_currency.toUpperCase(),
      grossReceive,
      netReceive,
      settlementCurrency: merchant.settlement_currency,
      settlementNetwork: merchant.settlement_network,
      settlementAddress: merchant.payout_address,
      successUrl: success_url,
      cancelUrl: cancel_url,
      metadata,
    });

    // Build checkout URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutUrl = generateCheckoutUrl(appUrl, order.id);

    const response: CreateCheckoutResponse = {
      order_id: order.id,
      checkout_url: checkoutUrl,
      expires_at: order.expires_at,
    };

    // Save idempotency key
    if (idempotencyKey) {
      await saveIdempotencyKey(idempotencyKey, merchant.id, response);
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
