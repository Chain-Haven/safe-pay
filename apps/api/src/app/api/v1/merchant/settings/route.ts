// GET/PUT /api/v1/merchant/settings
// Get or update merchant settings
import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/auth';
import { getMerchantById, updateMerchant } from '@/lib/database';
import {
  isValidSettlementCurrency,
  isValidSettlementNetwork,
  validateAddress,
} from '@/packages/shared';

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = await verifyRequest(request);
  if (!auth.success || !auth.merchant) {
    return NextResponse.json(
      { error: auth.error || 'Authentication failed' },
      { status: 401 }
    );
  }

  const merchant = auth.merchant;

  return NextResponse.json({
    id: merchant.id,
    store_name: merchant.store_name,
    store_url: merchant.store_url,
    settlement_currency: merchant.settlement_currency,
    settlement_network: merchant.settlement_network,
    payout_address: merchant.payout_address,
    payout_memo: merchant.payout_memo,
    test_mode: merchant.test_mode,
    created_at: merchant.created_at,
  });
}

export async function PUT(request: NextRequest) {
  // Verify authentication
  const auth = await verifyRequest(request);
  if (!auth.success || !auth.merchant) {
    return NextResponse.json(
      { error: auth.error || 'Authentication failed' },
      { status: 401 }
    );
  }

  try {
    // Body was consumed during auth verification, use the returned body
    const body = JSON.parse(auth.body || '{}');
    const updates: any = {};

    // Validate and apply updates
    if (body.settlement_currency !== undefined) {
      if (!isValidSettlementCurrency(body.settlement_currency)) {
        return NextResponse.json(
          { error: 'Invalid settlement currency' },
          { status: 400 }
        );
      }
      updates.settlement_currency = body.settlement_currency;
    }

    if (body.settlement_network !== undefined) {
      const currency = body.settlement_currency || auth.merchant.settlement_currency;
      if (!isValidSettlementNetwork(currency, body.settlement_network)) {
        return NextResponse.json(
          { error: 'Invalid settlement network' },
          { status: 400 }
        );
      }
      updates.settlement_network = body.settlement_network;
    }

    if (body.payout_address !== undefined) {
      const network = body.settlement_network || auth.merchant.settlement_network;
      if (!validateAddress(body.payout_address, network)) {
        return NextResponse.json(
          { error: 'Invalid payout address' },
          { status: 400 }
        );
      }
      updates.payout_address = body.payout_address;
    }

    if (body.payout_memo !== undefined) {
      updates.payout_memo = body.payout_memo || null;
    }

    if (body.test_mode !== undefined) {
      updates.test_mode = !!body.test_mode;
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      const updated = await updateMerchant(auth.merchant.id, updates);
      
      return NextResponse.json({
        success: true,
        merchant: {
          id: updated.id,
          settlement_currency: updated.settlement_currency,
          settlement_network: updated.settlement_network,
          payout_address: updated.payout_address,
          payout_memo: updated.payout_memo,
          test_mode: updated.test_mode,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No changes made',
    });
  } catch (error: any) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
