// GET /api/cron/cleanup
// Cleanup job for expired orders and records
import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredRecords, getExpiredPendingOrders, updateOrder } from '@/lib/database';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cleanup] Starting cleanup job...');

  try {
    // Mark expired orders
    const expiredOrders = await getExpiredPendingOrders();
    let markedExpired = 0;

    for (const order of expiredOrders) {
      await updateOrder(order.id, { status: 'expired' });
      markedExpired++;
    }

    // Clean up expired nonces and idempotency keys
    await cleanupExpiredRecords();

    console.log(`[Cleanup] Marked ${markedExpired} orders as expired`);
    console.log('[Cleanup] Cleaned up expired records');

    return NextResponse.json({
      success: true,
      marked_expired: markedExpired,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Cleanup] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
