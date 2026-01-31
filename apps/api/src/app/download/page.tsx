'use client';

import Link from 'next/link';

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">$</span>
              </div>
              <span className="text-gray-900 dark:text-white font-bold text-xl">SafePay</span>
            </Link>
            <Link 
              href="/"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Download SafePay Plugin
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            WooCommerce crypto payment gateway - Install in minutes
          </p>
        </div>

        {/* Download Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                wc-crypto-gateway.zip
              </h2>
              <p className="text-gray-600 dark:text-gray-400">Version 1.0.0 • WooCommerce 6.0+</p>
            </div>
            <a
              href="/api/download/plugin"
              download="wc-crypto-gateway.zip"
              className="bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-primary-700 transition flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </a>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-4">Requirements</h3>
            <ul className="space-y-2 text-gray-600 dark:text-gray-400">
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                WordPress 5.8 or higher
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                WooCommerce 6.0 or higher
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                PHP 7.4 or higher
              </li>
              <li className="flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                HTTPS enabled on your site
              </li>
            </ul>
          </div>
        </div>

        {/* Installation Guide */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Installation Guide
          </h2>
          
          <div className="space-y-6">
            <div className="flex">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary-600">1</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Download the plugin</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Click the download button above to get the latest version of wc-crypto-gateway.zip
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary-600">2</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Upload to WordPress</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Go to WordPress Admin → Plugins → Add New → Upload Plugin, then select the zip file
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary-600">3</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Activate the plugin</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  After installation, click "Activate Plugin" to enable SafePay
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary-600">4</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Configure settings</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Go to WooCommerce → Settings → Payments → SafePay Crypto. Enter your wallet address and select your preferred stablecoin (USDC/USDT) and network.
                </p>
              </div>
            </div>

            <div className="flex">
              <div className="flex-shrink-0 w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mr-4">
                <span className="font-semibold text-primary-600">5</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Start accepting payments</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  That's it! Your customers can now pay with 100+ cryptocurrencies.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Screenshot Placeholder */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Plugin Settings
          </h2>
          
          <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Settlement Currency
                </label>
                <div className="flex gap-3">
                  <span className="px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg font-medium">USDC</span>
                  <span className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-lg">USDT</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Network
                </label>
                <select className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                  <option>Ethereum (ERC20)</option>
                  <option>Polygon</option>
                  <option>Arbitrum</option>
                  <option>Tron (TRC20)</option>
                  <option>BNB Smart Chain</option>
                  <option>Solana</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payout Address
                </label>
                <input 
                  type="text" 
                  placeholder="0x..." 
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                What cryptocurrencies can customers pay with?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Over 100 cryptocurrencies including Bitcoin, Ethereum, Litecoin, XRP, Dogecoin, Solana, and many more. New coins are added regularly.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Do I need to create an account or get API keys?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No! SafePay uses public APIs that require no registration. Just install the plugin and enter your wallet address.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Is my money safe?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Yes! SafePay is non-custodial, meaning we never hold your funds. Payments are converted and sent directly to your wallet through decentralized swap providers.
              </p>
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="text-center mt-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Need help? Check out our documentation or open an issue on GitHub.
          </p>
          <a 
            href="https://github.com/Chain-Haven/safe-pay" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Visit GitHub Repository →
          </a>
        </div>
      </main>
    </div>
  );
}
