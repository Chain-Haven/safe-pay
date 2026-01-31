// GET /api/download/plugin
// Redirect to the WooCommerce plugin zip file
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Redirect to the static zip file in the public folder
  // The file is served statically by Next.js from /public/downloads/
  const downloadUrl = new URL('/downloads/wc-crypto-gateway.zip', request.url);
  
  return NextResponse.redirect(downloadUrl, {
    status: 302,
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
}
