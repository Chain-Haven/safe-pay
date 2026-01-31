import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SafePay - Non-Custodial Crypto Payments for WooCommerce',
  description: 'Accept crypto payments directly to your wallet. No custody, no KYC, no API keys. Just install and start accepting BTC, ETH, and 100+ cryptocurrencies.',
  keywords: ['crypto payments', 'woocommerce', 'bitcoin', 'ethereum', 'USDC', 'USDT', 'non-custodial'],
  openGraph: {
    title: 'SafePay - Non-Custodial Crypto Payments',
    description: 'Accept crypto payments directly to your wallet. Zero setup, no API keys required.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
