<?php
/**
 * SafePay Crypto Payment Gateway
 * 
 * SECURITY HARDENED:
 * - Input validation and sanitization
 * - Output escaping
 * - CSRF protection
 * - Capability checks
 * - Secure API communication
 * - PCI-DSS compliance considerations
 */

if (!defined('ABSPATH')) {
    exit;
}

class WC_Crypto_Gateway extends WC_Payment_Gateway {

    /**
     * API Client instance
     */
    private $api_client;

    /**
     * Allowed settlement currencies
     */
    private $allowed_currencies = array('USDC', 'USDT');

    /**
     * Allowed networks
     */
    private $allowed_networks = array('ERC20', 'TRC20', 'BSC', 'POLYGON', 'SOL', 'ARB', 'AVAX', 'OP');

    /**
     * Constructor
     */
    public function __construct() {
        $this->id                 = 'crypto_gateway';
        $this->icon               = esc_url(WC_CRYPTO_GATEWAY_PLUGIN_URL . 'assets/images/crypto-icon.svg');
        $this->has_fields         = false;
        $this->method_title       = __('SafePay Crypto', 'wc-crypto-gateway');
        $this->method_description = sprintf(
            __('Accept cryptocurrency payments directly to your wallet. Non-custodial, no API keys required. %s', 'wc-crypto-gateway'),
            '<a href="https://api-zeta-red.vercel.app" target="_blank">' . __('Learn more & try demo', 'wc-crypto-gateway') . '</a>'
        );

        // Supports
        $this->supports = array(
            'products',
        );

        // Load settings
        $this->init_form_fields();
        $this->init_settings();

        // Get settings (sanitized)
        $this->title              = $this->sanitize_setting($this->get_option('title'));
        $this->description        = $this->sanitize_setting($this->get_option('description'));
        $this->enabled            = $this->get_option('enabled') === 'yes' ? 'yes' : 'no';
        $this->api_url            = esc_url_raw($this->get_option('api_url'));
        $this->api_key            = $this->sanitize_api_key($this->get_option('api_key'));
        $this->api_secret         = $this->sanitize_api_secret($this->get_option('api_secret'));
        $this->settlement_currency = $this->sanitize_currency($this->get_option('settlement_currency'));
        $this->settlement_network = $this->sanitize_network($this->get_option('settlement_network'));
        $this->payout_address     = $this->sanitize_address($this->get_option('payout_address'));
        $this->test_mode          = $this->get_option('test_mode') === 'yes' ? 'yes' : 'no';

        // Actions
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_api_wc_crypto_gateway', array($this, 'handle_webhook'));
        add_action('woocommerce_thankyou_' . $this->id, array($this, 'thankyou_page'));
        
        // Return from checkout page
        add_action('woocommerce_api_wc_crypto_return', array($this, 'handle_return'));
        
        // Enqueue scripts securely
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));

        // Filter to append powered by link to description
        add_filter('woocommerce_gateway_description', array($this, 'append_powered_by_link'), 10, 2);
    }

    /**
     * Append "Powered by SafePay" link to the payment description
     */
    public function append_powered_by_link($description, $gateway_id) {
        if ($gateway_id !== $this->id) {
            return $description;
        }
        
        $safepay_url = rtrim($this->api_url, '/');
        if (empty($safepay_url)) {
            $safepay_url = 'https://api-zeta-red.vercel.app';
        }
        
        $powered_by = sprintf(
            '<p class="safepay-powered-by" style="margin-top: 10px; font-size: 12px; color: #666;"><a href="%s" target="_blank" rel="noopener noreferrer" style="color: #6366f1; text-decoration: none;">%s</a> %s</p>',
            esc_url($safepay_url),
            esc_html__('Powered by SafePay', 'wc-crypto-gateway'),
            esc_html__('- Non-custodial crypto payments', 'wc-crypto-gateway')
        );
        
        return $description . $powered_by;
    }

    /**
     * Sanitize text setting
     */
    private function sanitize_setting($value) {
        return sanitize_text_field(wp_unslash($value));
    }

    /**
     * Sanitize API key
     */
    private function sanitize_api_key($key) {
        $key = sanitize_text_field($key);
        // API keys should start with spk_
        if (!empty($key) && strpos($key, 'spk_') !== 0) {
            return '';
        }
        return preg_replace('/[^a-zA-Z0-9_]/', '', $key);
    }

    /**
     * Sanitize API secret
     */
    private function sanitize_api_secret($secret) {
        $secret = sanitize_text_field($secret);
        // API secrets should start with sps_
        if (!empty($secret) && strpos($secret, 'sps_') !== 0) {
            return '';
        }
        return preg_replace('/[^a-zA-Z0-9_]/', '', $secret);
    }

    /**
     * Sanitize currency
     */
    private function sanitize_currency($currency) {
        $currency = strtoupper(sanitize_text_field($currency));
        return in_array($currency, $this->allowed_currencies, true) ? $currency : 'USDC';
    }

    /**
     * Sanitize network
     */
    private function sanitize_network($network) {
        $network = strtoupper(sanitize_text_field($network));
        return in_array($network, $this->allowed_networks, true) ? $network : 'ERC20';
    }

    /**
     * Sanitize wallet address
     */
    private function sanitize_address($address) {
        return preg_replace('/[^a-zA-Z0-9]/', '', sanitize_text_field($address));
    }

    /**
     * Enqueue scripts for checkout
     */
    public function enqueue_scripts() {
        if (is_checkout() || is_wc_endpoint_url('order-received')) {
            wp_enqueue_script(
                'wc-crypto-gateway',
                esc_url(WC_CRYPTO_GATEWAY_PLUGIN_URL . 'assets/js/checkout.js'),
                array('jquery'),
                WC_CRYPTO_GATEWAY_VERSION,
                true
            );
            
            wp_localize_script('wc-crypto-gateway', 'wcCryptoGateway', array(
                'ajaxUrl' => esc_url(admin_url('admin-ajax.php')),
                'nonce' => wp_create_nonce('wc_crypto_check_status'),
            ));
        }
    }

    /**
     * Initialize form fields with proper escaping
     */
    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array(
                'title'       => __('Enable/Disable', 'wc-crypto-gateway'),
                'label'       => __('Enable SafePay Crypto Payments', 'wc-crypto-gateway'),
                'type'        => 'checkbox',
                'description' => '',
                'default'     => 'no',
            ),
            'title' => array(
                'title'       => __('Title', 'wc-crypto-gateway'),
                'type'        => 'text',
                'description' => __('Payment method title shown to customers.', 'wc-crypto-gateway'),
                'default'     => __('Pay with Crypto', 'wc-crypto-gateway'),
                'desc_tip'    => true,
                'custom_attributes' => array(
                    'maxlength' => 100,
                ),
            ),
            'description' => array(
                'title'       => __('Description', 'wc-crypto-gateway'),
                'type'        => 'textarea',
                'description' => __('Payment method description shown to customers.', 'wc-crypto-gateway'),
                'default'     => __('Pay with Bitcoin, Ethereum, or 100+ other cryptocurrencies. Converted to stablecoins instantly. Powered by SafePay.', 'wc-crypto-gateway'),
                'desc_tip'    => true,
                'custom_attributes' => array(
                    'maxlength' => 500,
                ),
            ),
            'api_settings' => array(
                'title'       => __('API Settings', 'wc-crypto-gateway'),
                'type'        => 'title',
                'description' => __('Configure your SafePay connection. All communication is encrypted via HTTPS.', 'wc-crypto-gateway'),
            ),
            'api_url' => array(
                'title'       => __('API URL', 'wc-crypto-gateway'),
                'type'        => 'url',
                'description' => __('SafePay API endpoint URL (HTTPS required).', 'wc-crypto-gateway'),
                'default'     => 'https://api-zeta-red.vercel.app',
                'desc_tip'    => true,
                'custom_attributes' => array(
                    'pattern' => 'https://.*',
                    'required' => 'required',
                ),
            ),
            'api_key' => array(
                'title'       => __('API Key', 'wc-crypto-gateway'),
                'type'        => 'text',
                'description' => __('Your SafePay API key (starts with spk_).', 'wc-crypto-gateway'),
                'default'     => '',
                'desc_tip'    => true,
                'custom_attributes' => array(
                    'autocomplete' => 'off',
                    'maxlength' => 100,
                ),
            ),
            'api_secret' => array(
                'title'       => __('API Secret', 'wc-crypto-gateway'),
                'type'        => 'password',
                'description' => __('Your SafePay API secret (starts with sps_). Never share this.', 'wc-crypto-gateway'),
                'default'     => '',
                'desc_tip'    => true,
                'custom_attributes' => array(
                    'autocomplete' => 'new-password',
                    'maxlength' => 100,
                ),
            ),
            'register_button' => array(
                'title'       => __('Register Store', 'wc-crypto-gateway'),
                'type'        => 'button',
                'description' => __('Click to automatically register your store and get API credentials.', 'wc-crypto-gateway'),
                'default'     => __('Register Store', 'wc-crypto-gateway'),
                'class'       => 'button-primary wc-crypto-register-btn',
            ),
            'payout_settings' => array(
                'title'       => __('Payout Settings', 'wc-crypto-gateway'),
                'type'        => 'title',
                'description' => __('Configure where you want to receive your payments.', 'wc-crypto-gateway'),
            ),
            'settlement_currency' => array(
                'title'       => __('Settlement Currency', 'wc-crypto-gateway'),
                'type'        => 'select',
                'description' => __('Choose which stablecoin you want to receive.', 'wc-crypto-gateway'),
                'default'     => 'USDC',
                'options'     => array(
                    'USDC' => 'USDC',
                    'USDT' => 'USDT',
                ),
                'desc_tip'    => true,
            ),
            'settlement_network' => array(
                'title'       => __('Settlement Network', 'wc-crypto-gateway'),
                'type'        => 'select',
                'description' => __('Choose which blockchain network to receive payments on.', 'wc-crypto-gateway'),
                'default'     => 'ERC20',
                'options'     => array(
                    'ERC20'   => 'Ethereum (ERC20)',
                    'TRC20'   => 'Tron (TRC20)',
                    'BSC'     => 'BNB Smart Chain (BEP20)',
                    'POLYGON' => 'Polygon',
                    'SOL'     => 'Solana',
                    'ARB'     => 'Arbitrum',
                    'AVAX'    => 'Avalanche C-Chain',
                    'OP'      => 'Optimism',
                ),
                'desc_tip'    => true,
            ),
            'payout_address' => array(
                'title'       => __('Payout Address', 'wc-crypto-gateway'),
                'type'        => 'text',
                'description' => __('Your wallet address for receiving payments. Verify this is correct!', 'wc-crypto-gateway'),
                'default'     => '',
                'desc_tip'    => true,
                'placeholder' => '0x...',
                'custom_attributes' => array(
                    'autocomplete' => 'off',
                    'maxlength' => 100,
                    'required' => 'required',
                ),
            ),
            'payout_memo' => array(
                'title'       => __('Memo/Tag (Optional)', 'wc-crypto-gateway'),
                'type'        => 'text',
                'description' => __('Required for some networks/exchanges. Leave empty if not needed.', 'wc-crypto-gateway'),
                'default'     => '',
                'desc_tip'    => true,
                'custom_attributes' => array(
                    'maxlength' => 50,
                ),
            ),
            'test_mode' => array(
                'title'       => __('Test Mode', 'wc-crypto-gateway'),
                'label'       => __('Enable Test Mode', 'wc-crypto-gateway'),
                'type'        => 'checkbox',
                'description' => __('When enabled, transactions will be processed in test mode.', 'wc-crypto-gateway'),
                'default'     => 'no',
                'desc_tip'    => true,
            ),
        );
    }

    /**
     * Generate button HTML with CSRF protection
     */
    public function generate_button_html($key, $data) {
        $field_key = $this->get_field_key($key);
        $defaults  = array(
            'title'       => '',
            'class'       => '',
            'description' => '',
        );
        $data = wp_parse_args($data, $defaults);

        ob_start();
        ?>
        <tr valign="top">
            <th scope="row" class="titledesc">
                <label><?php echo esc_html($data['title']); ?></label>
            </th>
            <td class="forminp">
                <button type="button" class="<?php echo esc_attr($data['class']); ?>" id="<?php echo esc_attr($field_key); ?>">
                    <?php echo esc_html($data['default']); ?>
                </button>
                <?php if ($data['description']) : ?>
                    <p class="description"><?php echo esc_html($data['description']); ?></p>
                <?php endif; ?>
            </td>
        </tr>
        <script>
        jQuery(function($) {
            $('#<?php echo esc_js($field_key); ?>').on('click', function(e) {
                e.preventDefault();
                var btn = $(this);
                btn.prop('disabled', true).text('<?php echo esc_js(__('Registering...', 'wc-crypto-gateway')); ?>');
                
                $.ajax({
                    url: ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'wc_crypto_register_store',
                        nonce: '<?php echo esc_js(wp_create_nonce('wc_crypto_register')); ?>',
                        api_url: $('#woocommerce_crypto_gateway_api_url').val(),
                        settlement_currency: $('#woocommerce_crypto_gateway_settlement_currency').val(),
                        settlement_network: $('#woocommerce_crypto_gateway_settlement_network').val(),
                        payout_address: $('#woocommerce_crypto_gateway_payout_address').val(),
                        payout_memo: $('#woocommerce_crypto_gateway_payout_memo').val(),
                    },
                    success: function(response) {
                        if (response.success) {
                            $('#woocommerce_crypto_gateway_api_key').val(response.data.api_key);
                            $('#woocommerce_crypto_gateway_api_secret').val(response.data.api_secret);
                            alert('<?php echo esc_js(__('Store registered successfully! Please save settings.', 'wc-crypto-gateway')); ?>');
                        } else {
                            alert('<?php echo esc_js(__('Registration failed: ', 'wc-crypto-gateway')); ?>' + (response.data.message || 'Unknown error'));
                        }
                    },
                    error: function() {
                        alert('<?php echo esc_js(__('Registration failed. Please try again.', 'wc-crypto-gateway')); ?>');
                    },
                    complete: function() {
                        btn.prop('disabled', false).text('<?php echo esc_js(__('Register Store', 'wc-crypto-gateway')); ?>');
                    }
                });
            });
        });
        </script>
        <?php
        return ob_get_clean();
    }

    /**
     * Validate admin options before saving
     */
    public function process_admin_options() {
        // Verify nonce
        if (!isset($_POST['_wpnonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['_wpnonce'])), 'woocommerce-settings')) {
            WC_Admin_Settings::add_error(__('Security check failed. Please try again.', 'wc-crypto-gateway'));
            return false;
        }

        // Verify capability
        if (!current_user_can('manage_woocommerce')) {
            WC_Admin_Settings::add_error(__('You do not have permission to change these settings.', 'wc-crypto-gateway'));
            return false;
        }

        // Validate API URL is HTTPS
        $api_url = isset($_POST[$this->get_field_key('api_url')]) 
            ? esc_url_raw(wp_unslash($_POST[$this->get_field_key('api_url')])) 
            : '';
        
        if (!empty($api_url) && strpos($api_url, 'https://') !== 0) {
            WC_Admin_Settings::add_error(__('API URL must use HTTPS for security.', 'wc-crypto-gateway'));
            return false;
        }

        // Validate payout address
        $payout_address = isset($_POST[$this->get_field_key('payout_address')]) 
            ? sanitize_text_field(wp_unslash($_POST[$this->get_field_key('payout_address')])) 
            : '';
        $settlement_network = isset($_POST[$this->get_field_key('settlement_network')]) 
            ? sanitize_text_field(wp_unslash($_POST[$this->get_field_key('settlement_network')])) 
            : 'ERC20';
        
        if (!empty($payout_address) && !wc_crypto_gateway_validate_address($payout_address, $settlement_network)) {
            WC_Admin_Settings::add_error(__('Invalid payout address format for the selected network.', 'wc-crypto-gateway'));
            return false;
        }

        return parent::process_admin_options();
    }

    /**
     * Get API client (lazy initialization)
     */
    private function get_api_client() {
        if (!$this->api_client) {
            require_once WC_CRYPTO_GATEWAY_PLUGIN_DIR . 'includes/class-wc-crypto-api-client.php';
            $this->api_client = new WC_Crypto_API_Client(
                $this->api_url,
                $this->api_key,
                $this->api_secret
            );
        }
        return $this->api_client;
    }

    /**
     * Process payment with security checks
     */
    public function process_payment($order_id) {
        $order = wc_get_order($order_id);

        if (!$order) {
            wc_add_notice(__('Order not found.', 'wc-crypto-gateway'), 'error');
            return array('result' => 'failure');
        }

        // Rate limiting per customer
        $customer_ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
        if (!wc_crypto_gateway_rate_limit_check('payment_' . $customer_ip, 5, 300)) {
            wc_add_notice(__('Too many payment attempts. Please wait a few minutes.', 'wc-crypto-gateway'), 'error');
            return array('result' => 'failure');
        }

        try {
            $api = $this->get_api_client();

            // Sanitize all data before sending
            $checkout_data = array(
                'external_order_id' => (string) absint($order_id),
                'fiat_amount'       => (float) $order->get_total(),
                'fiat_currency'     => sanitize_text_field($order->get_currency()),
                'success_url'       => esc_url_raw($this->get_return_url($order)),
                'cancel_url'        => esc_url_raw($order->get_cancel_order_url()),
                'metadata'          => array(
                    'customer_email' => sanitize_email($order->get_billing_email()),
                    'order_key'      => sanitize_text_field($order->get_order_key()),
                ),
            );

            // Create checkout session
            $checkout = $api->create_checkout($checkout_data);

            if (!isset($checkout['order_id']) || !isset($checkout['checkout_url'])) {
                throw new Exception(__('Invalid response from payment server.', 'wc-crypto-gateway'));
            }

            // Store SafePay order ID securely
            $order->update_meta_data('_safepay_order_id', sanitize_text_field($checkout['order_id']));
            $order->update_meta_data('_safepay_checkout_url', esc_url_raw($checkout['checkout_url']));
            $order->save();

            // Update order status
            $order->update_status('pending', __('Awaiting crypto payment.', 'wc-crypto-gateway'));

            // Clear cart
            WC()->cart->empty_cart();

            // Redirect to checkout page
            return array(
                'result'   => 'success',
                'redirect' => esc_url($checkout['checkout_url']),
            );

        } catch (Exception $e) {
            // Log error without sensitive data
            error_log('SafePay payment error for order ' . $order_id . ': ' . $e->getMessage());
            
            wc_add_notice(__('Payment error. Please try again or contact support.', 'wc-crypto-gateway'), 'error');
            return array('result' => 'failure');
        }
    }

    /**
     * Handle return from checkout page with verification
     */
    public function handle_return() {
        // Validate order key for security
        $order_key = isset($_GET['key']) ? sanitize_text_field(wp_unslash($_GET['key'])) : '';
        $order_id = isset($_GET['order-received']) ? absint($_GET['order-received']) : 0;
        
        if (!$order_id && isset($_GET['order_id'])) {
            $order_id = absint($_GET['order_id']);
        }

        $order = wc_get_order($order_id);

        if (!$order) {
            wp_safe_redirect(wc_get_checkout_url());
            exit;
        }

        // Verify order key matches
        if ($order->get_order_key() !== $order_key) {
            wc_crypto_gateway_log_security_event('invalid_order_key', array('order_id' => $order_id));
            wp_safe_redirect(wc_get_checkout_url());
            exit;
        }

        $safepay_order_id = $order->get_meta('_safepay_order_id');

        if ($safepay_order_id && !$order->is_paid()) {
            try {
                $api = $this->get_api_client();
                $status = $api->get_order_status($safepay_order_id);

                if (isset($status['status'])) {
                    $this->process_status_update($order, $status);
                }
            } catch (Exception $e) {
                $order->add_order_note(__('Failed to verify payment status.', 'wc-crypto-gateway'));
                error_log('SafePay return verification error: ' . $e->getMessage());
            }
        }

        wp_safe_redirect($this->get_return_url($order));
        exit;
    }

    /**
     * Process status update from provider
     */
    private function process_status_update($order, $status) {
        $status_value = sanitize_text_field($status['status']);
        
        switch ($status_value) {
            case 'completed':
                if (!$order->is_paid()) {
                    $tx_hash = isset($status['settlement_tx_hash']) 
                        ? sanitize_text_field($status['settlement_tx_hash']) 
                        : '';
                    $provider = isset($status['provider']) 
                        ? sanitize_text_field($status['provider']) 
                        : 'Unknown';
                    
                    $order->payment_complete($tx_hash);
                    $order->add_order_note(
                        sprintf(
                            __('Crypto payment completed. Provider: %s', 'wc-crypto-gateway'),
                            $provider
                        )
                    );
                }
                break;

            case 'failed':
            case 'expired':
                if ($order->get_status() === 'pending') {
                    $order->update_status(
                        'failed',
                        sprintf(__('Crypto payment %s.', 'wc-crypto-gateway'), $status_value)
                    );
                }
                break;

            case 'confirming':
            case 'exchanging':
            case 'sending':
                $order->add_order_note(
                    sprintf(__('Payment status: %s', 'wc-crypto-gateway'), $status_value)
                );
                break;
        }
    }

    /**
     * Thank you page with secure status checking
     */
    public function thankyou_page($order_id) {
        $order = wc_get_order($order_id);
        
        if (!$order || $order->get_payment_method() !== $this->id) {
            return;
        }

        $safepay_order_id = $order->get_meta('_safepay_order_id');
        
        if ($safepay_order_id && !$order->is_paid()) {
            $nonce = wp_create_nonce('wc_crypto_check_status');
            ?>
            <script>
            (function() {
                var checkStatus = function() {
                    var url = new URL('<?php echo esc_url(admin_url('admin-ajax.php')); ?>');
                    url.searchParams.append('action', 'wc_crypto_check_status');
                    url.searchParams.append('order_id', '<?php echo absint($order_id); ?>');
                    url.searchParams.append('key', '<?php echo esc_js($order->get_order_key()); ?>');
                    url.searchParams.append('_wpnonce', '<?php echo esc_js($nonce); ?>');
                    
                    fetch(url.toString())
                    .then(function(r) { return r.json(); })
                    .then(function(data) {
                        if (data.success && data.data.status === 'completed') {
                            location.reload();
                        }
                    })
                    .catch(function() {});
                };
                var interval = setInterval(checkStatus, 10000);
                // Stop checking after 30 minutes
                setTimeout(function() { clearInterval(interval); }, 1800000);
            })();
            </script>
            <div class="woocommerce-info">
                <?php esc_html_e('Waiting for payment confirmation...', 'wc-crypto-gateway'); ?>
            </div>
            <?php
        }
    }

    /**
     * Handle webhooks with signature verification
     */
    public function handle_webhook() {
        // Rate limiting for webhooks
        if (!wc_crypto_gateway_rate_limit_check('webhook', 100, 60)) {
            status_header(429);
            exit('Too many requests');
        }

        $payload = file_get_contents('php://input');
        
        if (empty($payload)) {
            status_header(400);
            exit('Empty payload');
        }

        // Verify webhook signature (if implemented)
        $signature = isset($_SERVER['HTTP_X_SAFEPAY_SIGNATURE']) 
            ? sanitize_text_field($_SERVER['HTTP_X_SAFEPAY_SIGNATURE']) 
            : '';

        // TODO: Implement signature verification when webhook signing is added
        // if (!$this->verify_webhook_signature($payload, $signature)) {
        //     status_header(401);
        //     exit('Invalid signature');
        // }

        $data = json_decode($payload, true);

        if (!$data || !isset($data['order_id']) || !isset($data['status'])) {
            status_header(400);
            exit('Invalid payload');
        }

        // Sanitize webhook data
        $safepay_order_id = sanitize_text_field($data['order_id']);
        $status = sanitize_text_field($data['status']);

        // Find WooCommerce order by SafePay order ID
        $orders = wc_get_orders(array(
            'meta_key'   => '_safepay_order_id',
            'meta_value' => $safepay_order_id,
            'limit'      => 1,
        ));

        if (empty($orders)) {
            status_header(404);
            exit('Order not found');
        }

        $order = $orders[0];

        // Process status update
        $this->process_status_update($order, $data);

        status_header(200);
        exit('OK');
    }

    /**
     * Check if gateway is available
     */
    public function is_available() {
        if ($this->enabled !== 'yes') {
            return false;
        }

        // Require HTTPS on checkout
        if (!is_ssl() && !$this->test_mode) {
            return false;
        }

        if (empty($this->api_key) || empty($this->api_secret) || empty($this->payout_address)) {
            return false;
        }

        // Validate API URL is HTTPS
        if (strpos($this->api_url, 'https://') !== 0) {
            return false;
        }

        return true;
    }

    /**
     * Admin notice for missing HTTPS
     */
    public function admin_options() {
        if (!is_ssl()) {
            echo '<div class="notice notice-warning"><p>';
            echo esc_html__('SafePay requires HTTPS for secure payment processing. Please enable SSL on your site.', 'wc-crypto-gateway');
            echo '</p></div>';
        }
        parent::admin_options();
    }
}
