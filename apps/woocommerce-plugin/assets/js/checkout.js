/**
 * SafePay Checkout - Wallet Integrations
 * 
 * Provides easy payment options through popular crypto wallets:
 * - MetaMask (browser extension)
 * - Coinbase Wallet
 * - Exodus (via deep links)
 * - Trust Wallet
 * - WalletConnect compatible wallets
 * 
 * All payments are swapped to the merchant's preferred stablecoin
 * through our non-custodial swap service.
 */

(function($) {
    'use strict';

    // Wallet integration configuration
    var SafePayWallet = {
        // Network configurations for EVM-compatible chains
        networks: {
            ethereum: {
                chainId: '0x1',
                chainName: 'Ethereum Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://eth.llamarpc.com'],
                blockExplorerUrls: ['https://etherscan.io']
            },
            polygon: {
                chainId: '0x89',
                chainName: 'Polygon',
                nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                rpcUrls: ['https://polygon-rpc.com'],
                blockExplorerUrls: ['https://polygonscan.com']
            },
            bsc: {
                chainId: '0x38',
                chainName: 'BNB Smart Chain',
                nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
                rpcUrls: ['https://bsc-dataseed.binance.org'],
                blockExplorerUrls: ['https://bscscan.com']
            },
            arbitrum: {
                chainId: '0xa4b1',
                chainName: 'Arbitrum One',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                blockExplorerUrls: ['https://arbiscan.io']
            },
            optimism: {
                chainId: '0xa',
                chainName: 'Optimism',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.optimism.io'],
                blockExplorerUrls: ['https://optimistic.etherscan.io']
            },
            avalanche: {
                chainId: '0xa86a',
                chainName: 'Avalanche C-Chain',
                nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
                rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
                blockExplorerUrls: ['https://snowtrace.io']
            }
        },

        // Current payment data
        paymentData: null,

        /**
         * Initialize wallet integrations
         */
        init: function() {
            var self = this;
            
            // Wait for DOM ready
            $(document).ready(function() {
                self.setupEventListeners();
                self.detectWallets();
            });
        },

        /**
         * Detect available wallets
         */
        detectWallets: function() {
            var wallets = {
                metamask: typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask,
                coinbase: typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet,
                exodus: typeof window.exodus !== 'undefined',
                trustWallet: typeof window.ethereum !== 'undefined' && window.ethereum.isTrust,
                anyEVM: typeof window.ethereum !== 'undefined'
            };

            // Store for later use
            this.availableWallets = wallets;
            
            console.log('[SafePay] Detected wallets:', wallets);
            
            return wallets;
        },

        /**
         * Setup event listeners
         */
        setupEventListeners: function() {
            var self = this;

            // Listen for SafePay payment page events
            $(document).on('safepay:payment-ready', function(e, data) {
                self.onPaymentReady(data);
            });

            // Wallet button clicks
            $(document).on('click', '.safepay-wallet-btn', function(e) {
                e.preventDefault();
                var wallet = $(this).data('wallet');
                var address = $(this).data('address');
                var amount = $(this).data('amount');
                var currency = $(this).data('currency');
                var network = $(this).data('network');

                self.handleWalletClick(wallet, address, amount, currency, network);
            });

            // Copy address button
            $(document).on('click', '.safepay-copy-btn', function(e) {
                e.preventDefault();
                var address = $(this).data('address');
                self.copyToClipboard(address);
            });
        },

        /**
         * Called when payment details are ready
         */
        onPaymentReady: function(data) {
            this.paymentData = data;
            this.renderWalletOptions(data);
        },

        /**
         * Render wallet connection options
         */
        renderWalletOptions: function(data) {
            var self = this;
            var $container = $('.safepay-wallet-options');
            
            if (!$container.length) {
                return;
            }

            var html = '<div class="safepay-wallets">';
            html += '<p class="safepay-wallet-title">Quick Pay with Wallet:</p>';
            html += '<div class="safepay-wallet-buttons">';

            // MetaMask button (for EVM chains)
            if (this.isEVMNetwork(data.network)) {
                html += this.createWalletButton('metamask', 'MetaMask', data);
            }

            // Coinbase Wallet
            if (this.isEVMNetwork(data.network)) {
                html += this.createWalletButton('coinbase', 'Coinbase Wallet', data);
            }

            // Exodus (deep link)
            html += this.createWalletButton('exodus', 'Exodus', data);

            // Trust Wallet (deep link)
            html += this.createWalletButton('trust', 'Trust Wallet', data);

            html += '</div>';

            // Copy address section
            html += '<div class="safepay-manual-pay">';
            html += '<p class="safepay-manual-title">Or send manually:</p>';
            html += '<div class="safepay-address-box">';
            html += '<code class="safepay-address">' + this.escapeHtml(data.depositAddress) + '</code>';
            html += '<button type="button" class="safepay-copy-btn" data-address="' + this.escapeHtml(data.depositAddress) + '">';
            html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            html += '</button>';
            html += '</div>';
            html += '<p class="safepay-amount">Send exactly: <strong>' + data.depositAmount + ' ' + data.currency + '</strong></p>';
            html += '</div>';

            html += '</div>';

            $container.html(html);
        },

        /**
         * Create wallet button HTML
         */
        createWalletButton: function(wallet, name, data) {
            var icons = {
                metamask: '<svg width="20" height="20" viewBox="0 0 35 33"><path fill="#E17726" d="M32.958 1L19.366 11.104l2.504-5.927L32.958 1z"/><path fill="#E27625" d="M2.042 1l13.467 10.204-2.38-6.027L2.042 1zM28.141 23.847l-3.617 5.54 7.738 2.129 2.22-7.538-6.341-.131zM0.534 23.978l2.207 7.538 7.726-2.13-3.604-5.539-6.329.131z"/></svg>',
                coinbase: '<svg width="20" height="20" viewBox="0 0 32 32"><circle fill="#0052FF" cx="16" cy="16" r="16"/><path fill="white" d="M16 6c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10S21.523 6 16 6zm0 15.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/></svg>',
                exodus: '<svg width="20" height="20" viewBox="0 0 32 32"><circle fill="#1F2033" cx="16" cy="16" r="16"/><path fill="#8B5CF6" d="M8 10l8-4 8 4v12l-8 4-8-4V10z"/></svg>',
                trust: '<svg width="20" height="20" viewBox="0 0 32 32"><circle fill="#0500FF" cx="16" cy="16" r="16"/><path fill="white" d="M16 6l10 4v8c0 5.5-4.5 10-10 10S6 23.5 6 18v-8l10-4z"/></svg>'
            };

            return '<button type="button" class="safepay-wallet-btn" data-wallet="' + wallet + '" ' +
                   'data-address="' + this.escapeHtml(data.depositAddress) + '" ' +
                   'data-amount="' + data.depositAmount + '" ' +
                   'data-currency="' + this.escapeHtml(data.currency) + '" ' +
                   'data-network="' + this.escapeHtml(data.network) + '">' +
                   (icons[wallet] || '') +
                   '<span>' + name + '</span>' +
                   '</button>';
        },

        /**
         * Handle wallet button click
         */
        handleWalletClick: function(wallet, address, amount, currency, network) {
            var self = this;

            switch (wallet) {
                case 'metamask':
                    this.connectMetaMask(address, amount, currency, network);
                    break;
                case 'coinbase':
                    this.connectCoinbase(address, amount, currency, network);
                    break;
                case 'exodus':
                    this.openExodus(address, amount, currency, network);
                    break;
                case 'trust':
                    this.openTrustWallet(address, amount, currency, network);
                    break;
                default:
                    this.copyToClipboard(address);
            }
        },

        /**
         * Connect MetaMask and initiate payment
         */
        connectMetaMask: async function(address, amount, currency, network) {
            var self = this;

            if (typeof window.ethereum === 'undefined') {
                // Open MetaMask download page
                window.open('https://metamask.io/download/', '_blank');
                this.showNotice('Please install MetaMask to use this feature.', 'info');
                return;
            }

            try {
                // Request account access
                var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                var userAddress = accounts[0];

                console.log('[SafePay] MetaMask connected:', userAddress);

                // Switch to correct network if needed
                var networkConfig = this.getNetworkConfig(network);
                if (networkConfig) {
                    await this.switchNetwork(networkConfig);
                }

                // Prepare transaction
                if (this.isNativeToken(currency)) {
                    // Native token transfer (ETH, MATIC, BNB, etc.)
                    await this.sendNativeToken(userAddress, address, amount, currency);
                } else {
                    // ERC20 token transfer
                    await this.sendERC20Token(userAddress, address, amount, currency, network);
                }

            } catch (error) {
                console.error('[SafePay] MetaMask error:', error);
                
                if (error.code === 4001) {
                    this.showNotice('Connection rejected. Please approve the connection to continue.', 'error');
                } else if (error.code === -32002) {
                    this.showNotice('Please check MetaMask - a connection request is pending.', 'info');
                } else {
                    this.showNotice('Failed to connect wallet. Please try again or pay manually.', 'error');
                }
            }
        },

        /**
         * Send native token (ETH, BNB, MATIC, etc.)
         */
        sendNativeToken: async function(from, to, amount, currency) {
            var weiAmount = this.toWei(amount);

            var txParams = {
                from: from,
                to: to,
                value: weiAmount,
                gas: '0x5208' // 21000 gas for simple transfer
            };

            try {
                var txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [txParams]
                });

                this.showNotice('Transaction sent! Hash: ' + txHash.substring(0, 10) + '...', 'success');
                this.trackTransaction(txHash);

            } catch (error) {
                if (error.code === 4001) {
                    this.showNotice('Transaction rejected by user.', 'error');
                } else {
                    throw error;
                }
            }
        },

        /**
         * Send ERC20 token
         */
        sendERC20Token: async function(from, to, amount, currency, network) {
            var self = this;
            var tokenAddress = this.getTokenAddress(currency, network);

            if (!tokenAddress) {
                this.showNotice('Token not supported on this network. Please send manually.', 'error');
                return;
            }

            // ERC20 transfer function signature
            var transferMethodId = '0xa9059cbb';
            
            // Pad the recipient address to 32 bytes
            var paddedTo = to.toLowerCase().replace('0x', '').padStart(64, '0');
            
            // Convert amount to token decimals (usually 18 for most, 6 for USDC/USDT)
            var decimals = (currency === 'USDC' || currency === 'USDT') ? 6 : 18;
            var tokenAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
            var paddedAmount = tokenAmount.toString(16).padStart(64, '0');
            
            var data = transferMethodId + paddedTo + paddedAmount;

            var txParams = {
                from: from,
                to: tokenAddress,
                data: data,
                gas: '0x186A0' // 100000 gas for ERC20 transfer
            };

            try {
                var txHash = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [txParams]
                });

                this.showNotice('Transaction sent! Hash: ' + txHash.substring(0, 10) + '...', 'success');
                this.trackTransaction(txHash);

            } catch (error) {
                if (error.code === 4001) {
                    this.showNotice('Transaction rejected by user.', 'error');
                } else {
                    throw error;
                }
            }
        },

        /**
         * Connect Coinbase Wallet
         */
        connectCoinbase: async function(address, amount, currency, network) {
            // Coinbase Wallet uses the same ethereum provider
            // or we can use the Coinbase Wallet SDK deep link
            
            if (typeof window.ethereum !== 'undefined' && window.ethereum.isCoinbaseWallet) {
                // Use MetaMask-style connection
                await this.connectMetaMask(address, amount, currency, network);
            } else {
                // Open Coinbase Wallet via deep link
                var uri = this.buildPaymentURI(address, amount, currency, network);
                var cbLink = 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(window.location.href);
                
                // Try deep link first
                window.location.href = 'cbwallet://dapp?url=' + encodeURIComponent(window.location.href);
                
                // Fallback to web
                setTimeout(function() {
                    window.open(cbLink, '_blank');
                }, 1000);
            }
        },

        /**
         * Open Exodus wallet
         */
        openExodus: function(address, amount, currency, network) {
            // Exodus supports various payment URI schemes
            var uri = this.buildPaymentURI(address, amount, currency, network);
            
            // Build deep link based on currency
            var scheme = this.getCurrencyScheme(currency);
            var deepLink = scheme + ':' + address + '?amount=' + amount;
            
            // Copy address first
            this.copyToClipboard(address);
            
            // Try to open Exodus
            var exodusLink = 'exodus://' + scheme + '/' + address + '?amount=' + amount;
            
            this.showNotice('Address copied! Opening Exodus...', 'info');
            
            // Try deep link
            window.location.href = exodusLink;
            
            // Show manual instructions after delay
            setTimeout(function() {
                alert('If Exodus didn\'t open automatically:\n\n1. Open Exodus app\n2. Select ' + currency + '\n3. Tap Send\n4. Paste address: ' + address + '\n5. Enter amount: ' + amount);
            }, 2000);
        },

        /**
         * Open Trust Wallet
         */
        openTrustWallet: function(address, amount, currency, network) {
            var self = this;
            
            // Copy address
            this.copyToClipboard(address);
            
            // Build Trust Wallet deep link
            var coinId = this.getTrustWalletCoinId(currency, network);
            var trustLink = 'trust://send?asset=' + coinId + '&address=' + address + '&amount=' + amount;
            
            this.showNotice('Address copied! Opening Trust Wallet...', 'info');
            
            // Try deep link
            window.location.href = trustLink;
            
            // Fallback message
            setTimeout(function() {
                if (document.hasFocus()) {
                    alert('If Trust Wallet didn\'t open:\n\n1. Open Trust Wallet app\n2. Select ' + currency + '\n3. Tap Send\n4. Paste address: ' + address + '\n5. Enter amount: ' + amount);
                }
            }, 2500);
        },

        /**
         * Switch to the correct network
         */
        switchNetwork: async function(networkConfig) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: networkConfig.chainId }]
                });
            } catch (switchError) {
                // Network not added, try to add it
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [networkConfig]
                    });
                } else {
                    throw switchError;
                }
            }
        },

        /**
         * Get network configuration
         */
        getNetworkConfig: function(network) {
            var networkMap = {
                'ERC20': 'ethereum',
                'POLYGON': 'polygon',
                'BSC': 'bsc',
                'ARB': 'arbitrum',
                'OP': 'optimism',
                'AVAX': 'avalanche'
            };
            
            var key = networkMap[network.toUpperCase()];
            return key ? this.networks[key] : null;
        },

        /**
         * Check if network is EVM compatible
         */
        isEVMNetwork: function(network) {
            var evmNetworks = ['ERC20', 'POLYGON', 'BSC', 'ARB', 'OP', 'AVAX', 'ETH', 'MATIC', 'BNB'];
            return evmNetworks.indexOf(network.toUpperCase()) !== -1;
        },

        /**
         * Check if currency is a native token
         */
        isNativeToken: function(currency) {
            var nativeTokens = ['ETH', 'MATIC', 'BNB', 'AVAX', 'SOL'];
            return nativeTokens.indexOf(currency.toUpperCase()) !== -1;
        },

        /**
         * Get token contract address
         */
        getTokenAddress: function(currency, network) {
            var tokens = {
                'USDC': {
                    'ERC20': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                    'POLYGON': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                    'BSC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
                    'ARB': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                    'OP': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
                    'AVAX': '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
                },
                'USDT': {
                    'ERC20': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                    'POLYGON': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
                    'BSC': '0x55d398326f99059fF775485246999027B3197955',
                    'ARB': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
                    'OP': '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
                    'AVAX': '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'
                }
            };

            return tokens[currency.toUpperCase()] && tokens[currency.toUpperCase()][network.toUpperCase()];
        },

        /**
         * Get currency URI scheme
         */
        getCurrencyScheme: function(currency) {
            var schemes = {
                'BTC': 'bitcoin',
                'ETH': 'ethereum',
                'LTC': 'litecoin',
                'DOGE': 'dogecoin',
                'XRP': 'ripple',
                'SOL': 'solana',
                'MATIC': 'polygon',
                'BNB': 'bnb',
                'USDT': 'ethereum',
                'USDC': 'ethereum'
            };
            return schemes[currency.toUpperCase()] || currency.toLowerCase();
        },

        /**
         * Get Trust Wallet coin ID
         */
        getTrustWalletCoinId: function(currency, network) {
            var coinIds = {
                'BTC': 'c0',
                'ETH': 'c60',
                'BNB': 'c714',
                'MATIC': 'c966',
                'SOL': 'c501',
                'LTC': 'c2',
                'DOGE': 'c3',
                'USDT_ERC20': 'c60_t0xdAC17F958D2ee523a2206206994597C13D831ec7',
                'USDC_ERC20': 'c60_t0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
            };
            
            var key = currency.toUpperCase();
            if (network) {
                key += '_' + network.toUpperCase();
            }
            
            return coinIds[key] || coinIds[currency.toUpperCase()] || 'c60';
        },

        /**
         * Build payment URI
         */
        buildPaymentURI: function(address, amount, currency, network) {
            var scheme = this.getCurrencyScheme(currency);
            return scheme + ':' + address + '?amount=' + amount;
        },

        /**
         * Convert amount to Wei (for ETH/EVM)
         */
        toWei: function(amount) {
            var wei = BigInt(Math.floor(parseFloat(amount) * 1e18));
            return '0x' + wei.toString(16);
        },

        /**
         * Track transaction status
         */
        trackTransaction: function(txHash) {
            // Store transaction for status checking
            var pending = JSON.parse(localStorage.getItem('safepay_pending_tx') || '[]');
            pending.push({
                hash: txHash,
                timestamp: Date.now()
            });
            localStorage.setItem('safepay_pending_tx', JSON.stringify(pending));

            // Notify the page
            $(document).trigger('safepay:transaction-sent', { hash: txHash });
        },

        /**
         * Copy text to clipboard
         */
        copyToClipboard: function(text) {
            var self = this;
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function() {
                    self.showNotice('Address copied to clipboard!', 'success');
                }).catch(function() {
                    self.fallbackCopy(text);
                });
            } else {
                this.fallbackCopy(text);
            }
        },

        /**
         * Fallback copy method
         */
        fallbackCopy: function(text) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                this.showNotice('Address copied to clipboard!', 'success');
            } catch (err) {
                this.showNotice('Please copy the address manually.', 'info');
            }
            
            document.body.removeChild(textarea);
        },

        /**
         * Show notice to user
         */
        showNotice: function(message, type) {
            // Remove existing notices
            $('.safepay-notice').remove();

            var classes = 'safepay-notice safepay-notice-' + type;
            var $notice = $('<div class="' + classes + '">' + this.escapeHtml(message) + '</div>');
            
            // Insert after wallet buttons or at top of payment form
            var $target = $('.safepay-wallets, .safepay-payment-form, .woocommerce-checkout-payment');
            if ($target.length) {
                $target.first().prepend($notice);
            } else {
                $('body').append($notice.css({ position: 'fixed', top: '20px', right: '20px', zIndex: 99999 }));
            }

            // Auto-remove after 5 seconds
            setTimeout(function() {
                $notice.fadeOut(function() { $(this).remove(); });
            }, 5000);
        },

        /**
         * Escape HTML
         */
        escapeHtml: function(text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    // Initialize
    SafePayWallet.init();

    // Expose globally for external use
    window.SafePayWallet = SafePayWallet;

})(jQuery);
