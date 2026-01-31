'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

// Coin interface
interface Coin {
  code: string;
  name: string;
  networks: string[];
  icon?: string;
}

// Demo order interface
interface DemoOrder {
  id: string;
  status: string;
  fiat_amount: number;
  fiat_currency: string;
  net_receive: number;
  settlement_currency: string;
  pay_currency?: string;
  pay_network?: string;
  deposit_address?: string;
  deposit_amount?: number;
  deposit_memo?: string;
  provider?: string;
  deposit_tx_hash?: string;
  settlement_tx_hash?: string;
  settlement_amount?: number;
  expires_at?: string;
  time_remaining?: { minutes: number; seconds: number; expired: boolean };
  is_demo: boolean;
}

// Live Demo component using actual production code
function LiveDemo() {
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 30, seconds: 0 });
  const [simulating, setSimulating] = useState(false);
  const [demoAmount, setDemoAmount] = useState(99);

  // Fetch coins on mount
  useEffect(() => {
    fetchCoins();
  }, []);

  const fetchCoins = async () => {
    try {
      const response = await fetch('/api/v1/coins');
      if (response.ok) {
        const data = await response.json();
        setCoins(data.coins || []);
      }
    } catch (error) {
      console.error('Failed to fetch coins:', error);
    }
  };

  // Create demo order
  const createDemoOrder = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/demo/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: demoAmount }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrder(data.order);
        setTimeRemaining({ minutes: 30, seconds: 0 });
      }
    } catch (error) {
      console.error('Failed to create demo:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create swap
  const createSwap = async () => {
    if (!order || !selectedCoin || !selectedNetwork) return;

    setCreating(true);
    try {
      const response = await fetch(`/api/v1/demo/${order.id}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pay_currency: selectedCoin.code,
          pay_network: selectedNetwork,
          order_amount: order.fiat_amount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setOrder(prev => prev ? {
          ...prev,
          status: 'awaiting_deposit',
          pay_currency: selectedCoin.code,
          pay_network: selectedNetwork,
          deposit_address: data.swap.deposit_address,
          deposit_amount: data.swap.deposit_amount,
          deposit_memo: data.swap.deposit_memo,
          provider: data.swap.provider,
        } : null);
      }
    } catch (error) {
      console.error('Failed to create swap:', error);
    } finally {
      setCreating(false);
    }
  };

  // Simulate payment
  const simulatePayment = async () => {
    if (!order) return;

    setSimulating(true);
    
    // Step 1: Confirming
    await simulateStep('pay');
    await delay(1500);
    
    // Step 2: Exchanging
    await simulateStep('confirm');
    await delay(1500);
    
    // Step 3: Sending
    await simulateStep('exchange');
    await delay(1500);
    
    // Step 4: Complete
    await simulateStep('complete');
    setSimulating(false);
  };

  const simulateStep = async (action: string) => {
    try {
      const response = await fetch(`/api/v1/demo/${order?.id}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrder(prev => prev ? { ...prev, ...data.order } : null);
      }
    } catch (error) {
      console.error('Simulate error:', error);
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Reset demo
  const resetDemo = () => {
    setOrder(null);
    setSelectedCoin(null);
    setSelectedNetwork('');
    setSearchQuery('');
    setSimulating(false);
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Timer
  useEffect(() => {
    if (!order || order.status !== 'awaiting_deposit') return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { minutes: prev.minutes - 1, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [order?.status]);

  // Filter coins
  const filteredCoins = coins.filter(coin =>
    coin.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Status messages
  const STATUS_INFO: Record<string, { title: string; description: string }> = {
    pending: { title: 'Select Payment Method', description: 'Choose your preferred cryptocurrency' },
    awaiting_deposit: { title: 'Awaiting Payment', description: 'Send the exact amount to the address below' },
    confirming: { title: 'Confirming Payment', description: 'Waiting for blockchain confirmations...' },
    exchanging: { title: 'Processing Exchange', description: 'Converting your payment to stablecoin...' },
    sending: { title: 'Sending to Merchant', description: 'Finalizing the payment...' },
    completed: { title: 'Payment Complete!', description: 'Your payment has been processed successfully' },
  };

  // Initial state - start demo button
  if (!order) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-w-md mx-auto">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="font-bold text-sm">$</span>
              </div>
              <span className="font-semibold">SafePay Checkout</span>
            </div>
            <span className="text-xs bg-green-500 px-2 py-1 rounded font-medium">LIVE DEMO</span>
          </div>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Try the Full Checkout Experience
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              This demo uses real API endpoints, real rate shopping, and the exact same checkout flow your customers will experience.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Demo Order Amount
            </label>
            <div className="flex items-center space-x-3">
              {[49, 99, 249].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setDemoAmount(amount)}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 font-medium transition ${
                    demoAmount === amount
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  ${amount}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={createDemoOrder}
            disabled={loading}
            className="w-full bg-primary-600 text-white py-4 rounded-xl font-semibold hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Starting Demo...
              </>
            ) : (
              <>
                Start Live Demo
                <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            No real payment required • Uses production API
          </p>
        </div>
      </div>
    );
  }

  // Main checkout flow
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
          <span className="text-xs bg-green-500 px-2 py-1 rounded font-medium">LIVE DEMO</span>
        </div>
      </div>

      {/* Order Summary */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400">Order Total</span>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            ${order.fiat_amount.toFixed(2)}
          </span>
        </div>
        <div className="text-sm text-gray-500 mt-1">Demo Store - Premium Widget</div>
      </div>

      {/* Status */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center text-sm">
          {order.status === 'completed' ? (
            <svg className="w-5 h-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : ['confirming', 'exchanging', 'sending'].includes(order.status) ? (
            <svg className="animate-spin h-5 w-5 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : null}
          <span className={`font-medium ${order.status === 'completed' ? 'text-green-600' : 'text-gray-700 dark:text-gray-300'}`}>
            {STATUS_INFO[order.status]?.title || 'Processing'}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {STATUS_INFO[order.status]?.description}
        </p>
      </div>

      <div className="p-4">
        {/* Coin Selection */}
        {order.status === 'pending' && (
          <>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search coins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="max-h-48 overflow-y-auto mb-4">
              <div className="grid grid-cols-3 gap-2">
                {filteredCoins.slice(0, 18).map((coin) => (
                  <button
                    key={coin.code}
                    onClick={() => {
                      setSelectedCoin(coin);
                      setSelectedNetwork(coin.networks[0] || '');
                    }}
                    className={`p-3 rounded-xl border-2 transition text-center ${
                      selectedCoin?.code === coin.code
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{coin.code}</div>
                    <div className="text-xs text-gray-500 truncate">{coin.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedCoin && selectedCoin.networks.length > 1 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Network
                </label>
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {selectedCoin.networks.map((network) => (
                    <option key={network} value={network}>{network}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={createSwap}
              disabled={!selectedCoin || !selectedNetwork || creating}
              className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition disabled:opacity-50 flex items-center justify-center"
            >
              {creating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Getting Best Rate...
                </>
              ) : (
                `Pay with ${selectedCoin?.code || 'Crypto'}`
              )}
            </button>

            {selectedCoin && (
              <p className="text-xs text-center text-gray-500 mt-2">
                Rate shopping across Exolix & FixedFloat
              </p>
            )}
          </>
        )}

        {/* Payment Details */}
        {order.status === 'awaiting_deposit' && order.deposit_address && (
          <>
            {/* Timer */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600 dark:text-gray-400 text-sm">Time Remaining</span>
              <span className={`font-mono font-bold ${
                timeRemaining.minutes < 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'
              }`}>
                {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-white rounded-xl shadow-inner">
                <QRCodeSVG
                  value={order.deposit_address}
                  size={160}
                  level="M"
                />
              </div>
            </div>

            {/* Amount */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">Send Exactly</label>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {order.deposit_amount} {order.pay_currency}
                </span>
                <button
                  onClick={() => copyToClipboard(String(order.deposit_amount), 'amount')}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  {copied === 'amount' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Address */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">To Address</label>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-900 dark:text-white break-all">
                    {order.deposit_address}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.deposit_address!, 'address')}
                    className="text-primary-600 hover:text-primary-700 ml-2 flex-shrink-0 text-sm font-medium"
                  >
                    {copied === 'address' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Memo if required */}
            {order.deposit_memo && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-yellow-600 mb-1">Memo/Tag (Required!)</label>
                <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3">
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {order.deposit_memo}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.deposit_memo!, 'memo')}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    {copied === 'memo' ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Provider Info */}
            <div className="text-center text-xs text-gray-500 mb-4">
              Network: <span className="font-medium">{order.pay_network}</span>
              {order.provider && order.provider !== 'demo' && (
                <span> • Via <span className="font-medium capitalize">{order.provider}</span></span>
              )}
            </div>

            {/* Simulate Payment Button */}
            <button
              onClick={simulatePayment}
              disabled={simulating}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center"
            >
              {simulating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Payment...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Simulate Payment Sent
                </>
              )}
            </button>
          </>
        )}

        {/* Processing States */}
        {['confirming', 'exchanging', 'sending'].includes(order.status) && (
          <div className="py-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-primary-100 dark:border-primary-900/30 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {order.status === 'confirming' && 'Confirming blockchain transaction...'}
              {order.status === 'exchanging' && 'Converting to USDC...'}
              {order.status === 'sending' && 'Sending to merchant wallet...'}
            </p>
            {order.deposit_tx_hash && (
              <p className="text-xs text-gray-500 mt-2 font-mono">
                TX: {order.deposit_tx_hash.slice(0, 16)}...
              </p>
            )}
          </div>
        )}

        {/* Success */}
        {order.status === 'completed' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Payment Complete!</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Merchant received ${order.net_receive?.toFixed(2) || order.fiat_amount.toFixed(2)} USDC
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-500">You paid:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {order.deposit_amount} {order.pay_currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Merchant received:</span>
                <span className="font-medium text-green-600">
                  ${order.net_receive?.toFixed(2) || order.fiat_amount.toFixed(2)} USDC
                </span>
              </div>
            </div>

            {order.settlement_tx_hash && (
              <p className="text-xs text-gray-500 font-mono mb-4">
                Settlement TX: {order.settlement_tx_hash.slice(0, 20)}...
              </p>
            )}

            <button
              onClick={resetDemo}
              className="bg-primary-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition"
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
            <div className="inline-flex items-center bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Live Production Demo
            </div>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Try the Real Checkout Experience
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              This demo uses actual production APIs, real rate shopping from Exolix & FixedFloat, and the exact same checkout flow your customers will experience.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Live Demo */}
            <div>
              <LiveDemo />
            </div>

            {/* Description */}
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <svg className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <h4 className="font-semibold text-green-800 dark:text-green-300">100% Production Code</h4>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      This demo runs the exact same APIs and UI that merchants and customers use in production.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Real Rate Shopping</h3>
                  <p className="text-gray-600 dark:text-gray-400">Live quotes from Exolix and FixedFloat - see actual exchange rates and provider selection.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Real QR Codes</h3>
                  <p className="text-gray-600 dark:text-gray-400">Scannable QR codes with actual deposit addresses (demo addresses for testing).</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Full Status Flow</h3>
                  <p className="text-gray-600 dark:text-gray-400">Experience the complete payment lifecycle: coin selection → payment → confirming → exchanging → complete.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Non-Custodial</h3>
                  <p className="text-gray-600 dark:text-gray-400">Payments are swapped and sent directly to merchant wallets - we never hold funds.</p>
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
            {/* Feature cards */}
            {[
              {
                icon: (
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Non-Custodial',
                description: 'Payments go directly to your wallet. We never hold your funds. No custody, no counterparty risk.',
                color: 'green',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Zero Setup',
                description: 'No API keys, no KYC, no account registration. Just install the plugin and enter your wallet address.',
                color: 'blue',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Best Rates',
                description: 'We rate-shop across multiple exchanges to find the best conversion rate for every transaction.',
                color: 'purple',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Stablecoin Settlement',
                description: 'Receive payments in USDC or USDT on your preferred network. No crypto volatility risk.',
                color: 'orange',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                ),
                title: '100+ Cryptocurrencies',
                description: 'Accept BTC, ETH, LTC, XRP, DOGE, SOL, and 100+ more. Your customers choose their favorite.',
                color: 'pink',
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
                title: 'Beautiful Checkout',
                description: 'Modern, responsive checkout page with QR codes, live status updates, and mobile-friendly design.',
                color: 'cyan',
              },
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8">
                <div className={`w-14 h-14 bg-${feature.color}-100 dark:bg-${feature.color}-900/30 rounded-xl flex items-center justify-center mb-6`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
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
            {[
              { step: '1', title: 'Install Plugin', description: 'Download and install the WooCommerce plugin in your WordPress admin' },
              { step: '2', title: 'Enter Wallet', description: 'Add your USDC/USDT wallet address and select your preferred network' },
              { step: '3', title: 'Customer Pays', description: 'Customer selects crypto, scans QR code, and sends payment' },
              { step: '4', title: 'Receive USDC', description: 'Stablecoins arrive directly in your wallet. Order marked as paid.' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-primary-600">{item.step}</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            ))}
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

          <div className="max-w-md mx-auto">
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
