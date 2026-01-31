// GET /api/download/plugin
// Stream the WooCommerce plugin zip file with proper headers
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  try {
    // Read the zip file from the public directory
    const zipPath = join(process.cwd(), 'public', 'downloads', 'wc-crypto-gateway.zip');
    const zipBuffer = await readFile(zipPath);
    
    // Return with proper headers for browser download
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="wc-crypto-gateway.zip"',
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error serving plugin zip:', error);
    
    // Fallback to redirect
    const downloadUrl = new URL('/downloads/wc-crypto-gateway.zip', request.url);
    return NextResponse.redirect(downloadUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
  }
}
