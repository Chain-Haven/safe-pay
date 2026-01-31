'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Demo checkout component
function DemoCheckout() {
  const [step, setStep] = useState<'select' | 'payment' | 'confirming' | 'complete'>('select');
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const demoCoins = [
    { code: 'BTC', name: 'Bitcoin', icon: '₿', color: 'bg-orange-500' },
    { code: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'bg-blue-500' },
    { code: 'SOL', name: 'Solana', icon: '◎', color: 'bg-purple-500' },
    { code: 'DOGE', name: 'Dogecoin', icon: 'Ð', color: 'bg-yellow-500' },
    { code: 'LTC', name: 'Litecoin', icon: 'Ł', color: 'bg-gray-500' },
    { code: 'XRP', name: 'Ripple', icon: '✕', color: 'bg-cyan-500' },
  ];

  const handleCoinSelect = (code: string) => {
    setSelectedCoin(code);
    setStep('payment');
  };

  const handleSimulatePayment = () => {
    setStep('confirming');
    setProgress(0);
    
    // Simulate confirmation progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('complete');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const resetDemo = () => {
    setStep('select');
    setSelectedCoin(null);
    setProgress(0);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="font-bold text-sm">$</span>
            </div>
            <span className="font-semibold">SafePay Checkout</span>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded">DEMO</span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Order Total</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">$99.00</span>
        </div>
        <div className="text-sm text-gray-500 mt-1">Demo Store - Premium Widget</div>
      </div>

      {/* Content based on step */}
      <div className="p-4">
        {step === 'select' && (
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Select Payment Method</h3>
            <div className="grid grid-cols-3 gap-3">
              {demoCoins.map((coin) => (
                <button
                  key={coin.code}
                  onClick={() => handleCoinSelect(coin.code)}
                  className="flex flex-col items-center p-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition"
                >
                  <div className={`w-10 h-10 ${coin.color} rounded-full flex items-center justify-center text-white font-bold mb-2`}>
                    {coin.icon}
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{coin.code}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 text-center mt-4">
              + 100 more cryptocurrencies supported
            </p>
          </div>
        )}

        {step === 'payment' && (
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
              Send {selectedCoin} to this address
            </h3>
            
            {/* QR Code placeholder */}
            <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden">
              <div className="absolute inset-0 grid grid-cols-8 gap-0.5 p-2">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${Math.random() > 0.5 ? 'bg-gray-900 dark:bg-white' : 'bg-transparent'}`}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded flex items-center justify-center">
                  <span className="text-2xl">
                    {demoCoins.find(c => c.code === selectedCoin)?.icon}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4 font-mono text-xs break-all">
              {selectedCoin === 'BTC' && '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'}
              {selectedCoin === 'ETH' && '0x742d35Cc6634C0532925a3b844Bc454e4438f44E'}
              {selectedCoin === 'SOL' && '7EYnhQoR9YM3N7UoaKRoA44Uy8JeaZV3qyouov87awMs'}
              {selectedCoin === 'DOGE' && 'D7Y55Xs2ByZBb5KYXMJKqk5kfxHqaJsJKs'}
              {selectedCoin === 'LTC' && 'LQ3B5Y4jw8CezQRq8KqSprPzpLxVYdMvst'}
              {selectedCoin === 'XRP' && 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh'}
            </div>

            <div className="flex justify-between text-sm mb-4">
              <span className="text-gray-500">Amount:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {selectedCoin === 'BTC' && '0.00102'}
                {selectedCoin === 'ETH' && '0.0312'}
                {selectedCoin === 'SOL' && '0.523'}
                {selectedCoin === 'DOGE' && '1,234'}
                {selectedCoin === 'LTC' && '1.12'}
                {selectedCoin === 'XRP' && '45.23'}
                {' '}{selectedCoin}
              </span>
            </div>

            <div className="flex items-center justify-center space-x-2 text-sm text-amber-600 mb-4">
              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span>Expires in 29:45</span>
            </div>

            <button
              onClick={handleSimulatePayment}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition"
            >
              Simulate Payment Sent
            </button>
            
            <button
              onClick={resetDemo}
              className="w-full text-gray-500 py-2 mt-2 text-sm hover:text-gray-700"
            >
              ← Choose different coin
            </button>
          </div>
        )}

        {step === 'confirming' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              <svg className="w-16 h-16 animate-spin text-primary-200" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Processing Payment</h3>
            <p className="text-gray-500 text-sm mb-4">Confirming your {selectedCoin} transaction...</p>
            
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
              <div 
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500">{Math.floor(progress / 33) + 1}/3 confirmations</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Payment Complete!</h3>
            <p className="text-gray-500 text-sm mb-4">
              Your order has been confirmed.<br/>
              Merchant received $98.01 USDC
            </p>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">You paid:</span>
                <span className="text-gray-900 dark:text-white">
                  {selectedCoin === 'BTC' && '0.00102 BTC'}
                  {selectedCoin === 'ETH' && '0.0312 ETH'}
                  {selectedCoin === 'SOL' && '0.523 SOL'}
                  {selectedCoin === 'DOGE' && '1,234 DOGE'}
                  {selectedCoin === 'LTC' && '1.12 LTC'}
                  {selectedCoin === 'XRP' && '45.23 XRP'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Merchant received:</span>
                <span className="text-green-600 font-medium">$98.01 USDC</span>
              </div>
            </div>
            
            <button
              onClick={resetDemo}
              className="mt-6 bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition"
            >
              Try Demo Again
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 dark:bg-gray-800 p-3 text-center">
        <span className="text-xs text-gray-500">
          Powered by <span className="font-medium text-primary-600">SafePay</span> • Non-custodial payments
        </span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const copyCommand = () => {
    navigator.clipboard.writeText('git clone https://github.com/Chain-Haven/safe-pay.git');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30"></div>
        
        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-primary-600 font-bold text-xl">$</span>
              </div>
              <span className="text-white font-bold text-xl">SafePay</span>
            </div>
            <div className="flex items-center space-x-6">
              <Link href="#demo" className="text-white/80 hover:text-white transition">Demo</Link>
              <Link href="#features" className="text-white/80 hover:text-white transition">Features</Link>
              <Link href="#how-it-works" className="text-white/80 hover:text-white transition">How It Works</Link>
              <Link href="/download" className="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 transition">
                Download Plugin
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Accept Crypto Payments
            <br />
            <span className="text-primary-200">Without the Complexity</span>
          </h1>
          <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
            Non-custodial WooCommerce payment gateway. Customers pay in BTC, ETH, or 100+ cryptos.
            You receive USDC/USDT directly to your wallet. Zero API keys. Zero custody.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/download" className="bg-white text-primary-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-50 transition shadow-lg">
              Download Free Plugin
            </Link>
            <a href="#demo" className="bg-primary-500/20 text-white border border-white/30 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-500/30 transition">
              Try Live Demo
            </a>
          </div>
          
          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-4xl font-bold text-white">100+</div>
              <div className="text-white/60">Cryptocurrencies</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white">0</div>
              <div className="text-white/60">API Keys Required</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white">&lt;2min</div>
              <div className="text-white/60">Setup Time</div>
            </div>
          </div>
        </div>
      </header>

      {/* Demo Section */}
      <section id="demo" className="py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Try the Checkout Experience
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              See exactly what your customers will experience
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Demo checkout */}
            <div>
              <DemoCheckout />
            </div>

            {/* Description */}
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Simple Coin Selection</h3>
                  <p className="text-gray-600 dark:text-gray-400">Customers choose from 100+ supported cryptocurrencies with a clean, intuitive interface.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">QR Code Payment</h3>
                  <p className="text-gray-600 dark:text-gray-400">Mobile-friendly QR codes make it easy to pay from any wallet app.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Real-time Status</h3>
                  <p className="text-gray-600 dark:text-gray-400">Live confirmation tracking shows customers exactly where their payment is.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Instant Stablecoin Settlement</h3>
                  <p className="text-gray-600 dark:text-gray-400">You receive USDC/USDT directly in your wallet - no volatility risk.</p>
                </div>
              </div>

              <div className="pt-4">
                <Link 
                  href="/download" 
                  className="inline-flex items-center bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition"
                >
                  Get Started Free
                  <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Why SafePay?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              The simplest way to accept crypto payments on WooCommerce
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Non-Custodial
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Payments go directly to your wallet. We never hold your funds. No custody, no counterparty risk.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Zero Setup
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No API keys, no KYC, no account registration. Just install the plugin and enter your wallet address.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Best Rates
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We rate-shop across multiple exchanges to find the best conversion rate for every transaction.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Stablecoin Settlement
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Receive payments in USDC or USDT on your preferred network. No crypto volatility risk.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/30 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                100+ Cryptocurrencies
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Accept BTC, ETH, LTC, XRP, DOGE, SOL, and 100+ more. Your customers choose their favorite.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
              <div className="w-14 h-14 bg-cyan-100 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                Beautiful Checkout
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Modern, responsive checkout page with QR codes, live status updates, and mobile-friendly design.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Simple setup, powerful results
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Install Plugin
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Download and install the WooCommerce plugin in your WordPress admin
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Enter Wallet
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add your USDC/USDT wallet address and select your preferred network
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Customer Pays
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Customer selects crypto, scans QR code, and sends payment
              </p>
            </div>

            {/* Step 4 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary-600">4</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Receive USDC
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Stablecoins arrive directly in your wallet. Order marked as paid.
              </p>
            </div>
          </div>

          {/* Flow Diagram */}
          <div className="mt-16 bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center p-4">
                <div className="text-3xl mb-2">👤</div>
                <div className="font-medium text-gray-900 dark:text-white">Customer</div>
                <div className="text-sm text-gray-500">Sends BTC/ETH/etc</div>
              </div>
              <div className="text-gray-400 text-2xl">→</div>
              <div className="text-center p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <div className="text-3xl mb-2">🔄</div>
                <div className="font-medium text-gray-900 dark:text-white">Swap Provider</div>
                <div className="text-sm text-gray-500">Instant conversion</div>
              </div>
              <div className="text-gray-400 text-2xl">→</div>
              <div className="text-center p-4">
                <div className="text-3xl mb-2">🏪</div>
                <div className="font-medium text-gray-900 dark:text-white">Your Wallet</div>
                <div className="text-sm text-gray-500">Receives USDC/USDT</div>
              </div>
            </div>
            <p className="text-center text-gray-500 dark:text-gray-400 mt-6 text-sm">
              We never hold your funds. Payments are converted and sent directly to your wallet via decentralized swap providers.
            </p>
          </div>
        </div>
      </section>

      {/* Installation Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Quick Installation
            </h2>
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm">Clone and deploy</span>
              <button
                onClick={copyCommand}
                className="text-primary-400 hover:text-primary-300 text-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code className="text-green-400 font-mono">
              git clone https://github.com/Chain-Haven/safe-pay.git
            </code>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">For Merchants</h3>
              <ol className="space-y-3 text-gray-600 dark:text-gray-400">
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">1.</span>
                  Download the plugin from /download
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">2.</span>
                  Install in WordPress via Plugins → Add New
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">3.</span>
                  Go to WooCommerce → Settings → Payments
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">4.</span>
                  Enable SafePay and enter your wallet address
                </li>
              </ol>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Self-Hosting</h3>
              <ol className="space-y-3 text-gray-600 dark:text-gray-400">
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">1.</span>
                  Deploy to Vercel (free tier)
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">2.</span>
                  Create Supabase project (free tier)
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">3.</span>
                  Set SUPABASE_URL and SERVICE_ROLE_KEY
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-primary-600 mr-2">4.</span>
                  Run database migrations
                </li>
              </ol>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link 
              href="/download" 
              className="inline-flex items-center bg-primary-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-primary-700 transition"
            >
              Download Plugin
              <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-primary-600 font-bold">$</span>
              </div>
              <span className="text-white font-bold">SafePay</span>
            </div>
            <div className="flex space-x-8">
              <a href="https://github.com/Chain-Haven/safe-pay" className="text-gray-400 hover:text-white transition">
                GitHub
              </a>
              <Link href="/download" className="text-gray-400 hover:text-white transition">
                Download
              </Link>
              <Link href="#demo" className="text-gray-400 hover:text-white transition">
                Demo
              </Link>
              <a href="mailto:support@safepay.example" className="text-gray-400 hover:text-white transition">
                Support
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            <p>Open source. Non-custodial. Zero API keys required.</p>
            <p className="mt-2">© {new Date().getFullYear()} SafePay. MIT License.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
