'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

interface OrderData {
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
  provider_status?: string;
  deposit_tx_hash?: string;
  settlement_tx_hash?: string;
  success_url: string;
  cancel_url: string;
  expires_at: string;
  time_remaining: {
    minutes: number;
    seconds: number;
    expired: boolean;
  };
}

interface Coin {
  code: string;
  name: string;
  networks: string[];
  icon?: string;
}

interface SwapResult {
  provider: string;
  deposit_address: string;
  deposit_amount: number;
  deposit_currency: string;
  deposit_network: string;
  deposit_memo?: string;
  expires_at: string;
}

const STATUS_MESSAGES: Record<string, { title: string; description: string; color: string }> = {
  pending: {
    title: 'Select Payment Method',
    description: 'Choose your preferred cryptocurrency',
    color: 'blue',
  },
  awaiting_deposit: {
    title: 'Awaiting Payment',
    description: 'Send the exact amount to the address below',
    color: 'yellow',
  },
  confirming: {
    title: 'Confirming Payment',
    description: 'Waiting for blockchain confirmations',
    color: 'blue',
  },
  exchanging: {
    title: 'Processing Exchange',
    description: 'Converting your payment to stablecoin',
    color: 'blue',
  },
  sending: {
    title: 'Sending to Merchant',
    description: 'Finalizing the payment',
    color: 'blue',
  },
  completed: {
    title: 'Payment Complete!',
    description: 'Your payment has been processed successfully',
    color: 'green',
  },
  failed: {
    title: 'Payment Failed',
    description: 'There was an issue with your payment',
    color: 'red',
  },
  expired: {
    title: 'Order Expired',
    description: 'This payment session has expired',
    color: 'gray',
  },
};

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 0, seconds: 0 });

  // Fetch order details
  const fetchOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/checkout/${orderId}`);
      if (!response.ok) {
        throw new Error('Order not found');
      }
      const data = await response.json();
      setOrder(data);
      
      if (data.time_remaining) {
        setTimeRemaining({
          minutes: data.time_remaining.minutes,
          seconds: data.time_remaining.seconds,
        });
      }

      // Redirect on completion
      if (data.status === 'completed' && data.success_url) {
        setTimeout(() => {
          window.location.href = data.success_url;
        }, 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Fetch supported coins
  const fetchCoins = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/coins');
      if (response.ok) {
        const data = await response.json();
        setCoins(data.coins || []);
      }
    } catch {
      console.error('Failed to fetch coins');
    }
  }, []);

  // Poll for status updates
  useEffect(() => {
    fetchOrder();
    fetchCoins();
  }, [fetchOrder, fetchCoins]);

  // Status polling
  useEffect(() => {
    if (!order || ['completed', 'failed', 'expired'].includes(order.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/checkout/${orderId}/status`);
        if (response.ok) {
          const status = await response.json();
          setOrder(prev => prev ? { ...prev, ...status } : prev);
          
          if (status.status === 'completed' && order.success_url) {
            setTimeout(() => {
              window.location.href = order.success_url;
            }, 3000);
          }
        }
      } catch {
        console.error('Status poll failed');
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [order, orderId]);

  // Timer countdown
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

  // Create swap
  const createSwap = async () => {
    if (!selectedCoin || !selectedNetwork) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/checkout/${orderId}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pay_currency: selectedCoin.code,
          pay_network: selectedNetwork,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create swap');
      }

      // Refresh order
      await fetchOrder();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Filter coins by search
  const filteredCoins = coins.filter(coin =>
    coin.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    coin.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Order Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const statusInfo = STATUS_MESSAGES[order.status] || STATUS_MESSAGES.pending;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">$</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SafePay Checkout</h1>
        </div>

        {/* Order Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 dark:text-gray-400">Amount Due</span>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {order.fiat_amount.toFixed(2)} {order.fiat_currency}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500 dark:text-gray-500">You'll receive</span>
            <span className="text-gray-600 dark:text-gray-400">
              ~{order.net_receive.toFixed(2)} {order.settlement_currency}
            </span>
          </div>
        </div>

        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <div className={`flex items-center mb-4 ${
            statusInfo.color === 'green' ? 'text-green-600' :
            statusInfo.color === 'yellow' ? 'text-yellow-600' :
            statusInfo.color === 'red' ? 'text-red-600' :
            statusInfo.color === 'gray' ? 'text-gray-500' :
            'text-primary-600'
          }`}>
            {order.status === 'completed' ? (
              <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : ['confirming', 'exchanging', 'sending'].includes(order.status) ? (
              <div className="w-6 h-6 mr-2">
                <div className="spinner !w-6 !h-6 !border-2"></div>
              </div>
            ) : null}
            <h2 className="text-lg font-semibold">{statusInfo.title}</h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{statusInfo.description}</p>
        </div>

        {/* Coin Selection (for pending orders) */}
        {order.status === 'pending' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Select Payment Currency</h3>
            
            {/* Search */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search coins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Coin Grid */}
            <div className="max-h-64 overflow-y-auto mb-4">
              <div className="grid grid-cols-3 gap-2">
                {filteredCoins.slice(0, 30).map((coin) => (
                  <button
                    key={coin.code}
                    onClick={() => {
                      setSelectedCoin(coin);
                      setSelectedNetwork(coin.networks[0] || '');
                    }}
                    className={`p-3 rounded-xl border-2 transition text-center ${
                      selectedCoin?.code === coin.code
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{coin.code}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{coin.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Network Selection */}
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

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={createSwap}
              disabled={!selectedCoin || !selectedNetwork || creating}
              className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {creating ? (
                <>
                  <div className="spinner !w-5 !h-5 !border-2 !border-white !border-t-transparent mr-2"></div>
                  Creating Payment...
                </>
              ) : (
                `Pay with ${selectedCoin?.code || 'Crypto'}`
              )}
            </button>
          </div>
        )}

        {/* Payment Details (for awaiting_deposit) */}
        {order.status === 'awaiting_deposit' && order.deposit_address && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
            {/* Timer */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-600 dark:text-gray-400">Time Remaining</span>
              <span className={`font-mono text-lg font-bold ${
                timeRemaining.minutes < 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'
              }`}>
                {String(timeRemaining.minutes).padStart(2, '0')}:{String(timeRemaining.seconds).padStart(2, '0')}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG
                  value={order.deposit_address}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Amount */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Send Exactly
              </label>
              <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <span className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                  {order.deposit_amount} {order.pay_currency}
                </span>
                <button
                  onClick={() => copyToClipboard(String(order.deposit_amount), 'amount')}
                  className="text-primary-600 hover:text-primary-700"
                >
                  {copied === 'amount' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Address */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                To Address
              </label>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-gray-900 dark:text-white break-all">
                    {order.deposit_address}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.deposit_address!, 'address')}
                    className="text-primary-600 hover:text-primary-700 ml-2 flex-shrink-0"
                  >
                    {copied === 'address' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Memo if required */}
            {order.deposit_memo && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Memo/Tag (Required!)
                </label>
                <div className="flex items-center justify-between bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    {order.deposit_memo}
                  </span>
                  <button
                    onClick={() => copyToClipboard(order.deposit_memo!, 'memo')}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {copied === 'memo' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {/* Network Info */}
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              Network: <span className="font-medium">{order.pay_network}</span>
              {order.provider && (
                <span> • Via {order.provider}</span>
              )}
            </div>
          </div>
        )}

        {/* Processing Status */}
        {['confirming', 'exchanging', 'sending'].includes(order.status) && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex flex-col items-center py-8">
              <div className="relative mb-6">
                <div className="w-20 h-20 border-4 border-primary-100 dark:border-primary-900/30 rounded-full"></div>
                <div className="absolute inset-0 w-20 h-20 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 text-center">
                {order.status === 'confirming' && 'Waiting for blockchain confirmations...'}
                {order.status === 'exchanging' && 'Converting your payment...'}
                {order.status === 'sending' && 'Sending to merchant...'}
              </p>

              {order.deposit_tx_hash && (
                <div className="mt-4 text-sm">
                  <span className="text-gray-500">Deposit TX: </span>
                  <code className="text-primary-600 break-all">{order.deposit_tx_hash.slice(0, 20)}...</code>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success */}
        {order.status === 'completed' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
            <div className="flex flex-col items-center py-8">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Payment Complete!</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                Your payment has been processed successfully.
              </p>

              {order.settlement_tx_hash && (
                <div className="text-sm text-center">
                  <span className="text-gray-500">Settlement TX: </span>
                  <code className="text-primary-600 break-all">{order.settlement_tx_hash}</code>
                </div>
              )}

              <p className="text-sm text-gray-500 mt-4">
                Redirecting to store in 3 seconds...
              </p>
            </div>
          </div>
        )}

        {/* Cancel Link */}
        {['pending', 'awaiting_deposit'].includes(order.status) && order.cancel_url && (
          <div className="text-center">
            <a
              href={order.cancel_url}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm"
            >
              Cancel and return to store
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by SafePay • Non-custodial payments</p>
        </div>
      </div>
    </div>
  );
}
