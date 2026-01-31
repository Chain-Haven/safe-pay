<?php
/**
 * SafePay API Client
 * 
 * SECURITY HARDENED:
 * - HTTPS only communication
 * - Request signing with HMAC-SHA256
 * - Input validation
 * - Timeout protection
 * - No sensitive data in logs
 */

if (!defined('ABSPATH')) {
    exit;
}

class WC_Crypto_API_Client {

    /**
     * API base URL (must be HTTPS)
     */
    private $api_url;

    /**
     * API key
     */
    private $api_key;

    /**
     * API secret (never logged)
     */
    private $api_secret;

    /**
     * Request timeout in seconds
     */
    private $timeout = 30;

    /**
     * Constructor
     */
    public function __construct($api_url, $api_key, $api_secret) {
        // Ensure HTTPS
        $this->api_url = $this->validate_url($api_url);
        $this->api_key = $this->sanitize_key($api_key);
        $this->api_secret = $api_secret; // Don't sanitize secrets, they need exact match
    }

    /**
     * Validate and sanitize URL (must be HTTPS)
     */
    private function validate_url($url) {
        $url = esc_url_raw(rtrim($url, '/'));
        
        if (strpos($url, 'https://') !== 0) {
            throw new Exception(__('API URL must use HTTPS.', 'wc-crypto-gateway'));
        }
        
        return $url;
    }

    /**
     * Sanitize API key
     */
    private function sanitize_key($key) {
        return preg_replace('/[^a-zA-Z0-9_]/', '', sanitize_text_field($key));
    }

    /**
     * Generate random nonce
     */
    private function generate_nonce() {
        if (function_exists('random_bytes')) {
            return bin2hex(random_bytes(16));
        }
        return wp_generate_password(32, false, false);
    }

    /**
     * Create HMAC-SHA256 signature
     */
    private function create_signature($timestamp, $nonce, $body) {
        $payload = $timestamp . $nonce . $body;
        return hash_hmac('sha256', $payload, $this->api_secret);
    }

    /**
     * Make authenticated API request
     */
    private function request($endpoint, $method = 'GET', $data = null) {
        $url = $this->api_url . $endpoint;
        $body = $data ? wp_json_encode($data) : '';
        $timestamp = (string) time();
        $nonce = $this->generate_nonce();
        $signature = $this->create_signature($timestamp, $nonce, $body);

        $headers = array(
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
            'X-API-Key'     => $this->api_key,
            'X-Timestamp'   => $timestamp,
            'X-Nonce'       => $nonce,
            'X-Signature'   => $signature,
        );

        $args = array(
            'method'      => $method,
            'headers'     => $headers,
            'timeout'     => $this->timeout,
            'sslverify'   => true, // Always verify SSL
            'data_format' => 'body',
        );

        if ($body) {
            $args['body'] = $body;
        }

        // Use WordPress HTTP API
        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            // Log without sensitive data
            error_log('SafePay API request failed: ' . $response->get_error_message());
            throw new Exception(__('Payment server unavailable. Please try again.', 'wc-crypto-gateway'));
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $response_data = json_decode($response_body, true);

        if ($status_code >= 400) {
            $error_message = isset($response_data['error']) 
                ? sanitize_text_field($response_data['error']) 
                : __('Payment server error.', 'wc-crypto-gateway');
            
            // Don't expose internal error details
            error_log('SafePay API error: ' . $status_code);
            throw new Exception($error_message);
        }

        return $response_data;
    }

    /**
     * Make unauthenticated API request (for public endpoints)
     */
    private function public_request($endpoint, $method = 'GET', $data = null) {
        $url = $this->api_url . $endpoint;

        $args = array(
            'method'      => $method,
            'headers'     => array(
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
            ),
            'timeout'     => $this->timeout,
            'sslverify'   => true,
            'data_format' => 'body',
        );

        if ($data) {
            $args['body'] = wp_json_encode($data);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            error_log('SafePay public API request failed: ' . $response->get_error_message());
            throw new Exception(__('Payment server unavailable.', 'wc-crypto-gateway'));
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $response_body = wp_remote_retrieve_body($response);
        $response_data = json_decode($response_body, true);

        if ($status_code >= 400) {
            $error_message = isset($response_data['error']) 
                ? sanitize_text_field($response_data['error']) 
                : __('Request failed.', 'wc-crypto-gateway');
            throw new Exception($error_message);
        }

        return $response_data;
    }

    /**
     * Register a new merchant
     */
    public function register_merchant($data) {
        // Sanitize registration data
        $sanitized_data = array(
            'store_name'          => sanitize_text_field($data['store_name'] ?? ''),
            'store_url'           => esc_url_raw($data['store_url'] ?? ''),
            'settlement_currency' => sanitize_text_field($data['settlement_currency'] ?? 'USDC'),
            'settlement_network'  => sanitize_text_field($data['settlement_network'] ?? 'ERC20'),
            'payout_address'      => preg_replace('/[^a-zA-Z0-9]/', '', $data['payout_address'] ?? ''),
            'payout_memo'         => sanitize_text_field($data['payout_memo'] ?? ''),
            'test_mode'           => !empty($data['test_mode']),
        );

        return $this->public_request('/api/v1/merchant/register', 'POST', $sanitized_data);
    }

    /**
     * Create checkout session
     */
    public function create_checkout($data) {
        // Validate required fields
        $required = array('external_order_id', 'fiat_amount', 'fiat_currency', 'success_url', 'cancel_url');
        foreach ($required as $field) {
            if (empty($data[$field])) {
                throw new Exception(sprintf(__('Missing required field: %s', 'wc-crypto-gateway'), $field));
            }
        }

        // Sanitize checkout data
        $sanitized_data = array(
            'external_order_id' => sanitize_text_field($data['external_order_id']),
            'fiat_amount'       => (float) $data['fiat_amount'],
            'fiat_currency'     => sanitize_text_field(strtoupper($data['fiat_currency'])),
            'success_url'       => esc_url_raw($data['success_url']),
            'cancel_url'        => esc_url_raw($data['cancel_url']),
        );

        // Add optional metadata
        if (!empty($data['metadata']) && is_array($data['metadata'])) {
            $sanitized_data['metadata'] = array_map('sanitize_text_field', $data['metadata']);
        }

        return $this->request('/api/v1/checkout/create', 'POST', $sanitized_data);
    }

    /**
     * Get order status
     */
    public function get_order_status($order_id) {
        $order_id = sanitize_text_field($order_id);
        
        // Validate order ID format
        if (!preg_match('/^ord_[a-z0-9]+$/i', $order_id)) {
            throw new Exception(__('Invalid order ID format.', 'wc-crypto-gateway'));
        }

        return $this->public_request('/api/v1/checkout/' . $order_id . '/status', 'GET');
    }

    /**
     * Get merchant settings
     */
    public function get_settings() {
        return $this->request('/api/v1/merchant/settings', 'GET');
    }

    /**
     * Update merchant settings
     */
    public function update_settings($data) {
        $sanitized_data = array();
        
        if (isset($data['settlement_currency'])) {
            $sanitized_data['settlement_currency'] = sanitize_text_field($data['settlement_currency']);
        }
        if (isset($data['settlement_network'])) {
            $sanitized_data['settlement_network'] = sanitize_text_field($data['settlement_network']);
        }
        if (isset($data['payout_address'])) {
            $sanitized_data['payout_address'] = preg_replace('/[^a-zA-Z0-9]/', '', $data['payout_address']);
        }
        if (isset($data['payout_memo'])) {
            $sanitized_data['payout_memo'] = sanitize_text_field($data['payout_memo']);
        }
        if (isset($data['test_mode'])) {
            $sanitized_data['test_mode'] = !empty($data['test_mode']);
        }

        return $this->request('/api/v1/merchant/settings', 'PUT', $sanitized_data);
    }
}

/**
 * AJAX handler for store registration (with full security)
 */
add_action('wp_ajax_wc_crypto_register_store', function() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'wc_crypto_register')) {
        wp_send_json_error(array('message' => __('Security check failed.', 'wc-crypto-gateway')));
        return;
    }

    // Verify capability
    if (!current_user_can('manage_woocommerce')) {
        wp_send_json_error(array('message' => __('Unauthorized.', 'wc-crypto-gateway')));
        return;
    }

    // Rate limiting
    if (!wc_crypto_gateway_rate_limit_check('registration', 3, 3600)) {
        wp_send_json_error(array('message' => __('Too many registration attempts. Please wait.', 'wc-crypto-gateway')));
        return;
    }

    // Get and validate inputs
    $api_url = isset($_POST['api_url']) ? esc_url_raw(wp_unslash($_POST['api_url'])) : '';
    $settlement_currency = isset($_POST['settlement_currency']) ? sanitize_text_field(wp_unslash($_POST['settlement_currency'])) : 'USDC';
    $settlement_network = isset($_POST['settlement_network']) ? sanitize_text_field(wp_unslash($_POST['settlement_network'])) : 'ERC20';
    $payout_address = isset($_POST['payout_address']) ? sanitize_text_field(wp_unslash($_POST['payout_address'])) : '';
    $payout_memo = isset($_POST['payout_memo']) ? sanitize_text_field(wp_unslash($_POST['payout_memo'])) : '';

    // Validate required fields
    if (empty($api_url)) {
        wp_send_json_error(array('message' => __('API URL is required.', 'wc-crypto-gateway')));
        return;
    }

    if (strpos($api_url, 'https://') !== 0) {
        wp_send_json_error(array('message' => __('API URL must use HTTPS.', 'wc-crypto-gateway')));
        return;
    }

    if (empty($payout_address)) {
        wp_send_json_error(array('message' => __('Payout address is required.', 'wc-crypto-gateway')));
        return;
    }

    // Validate payout address format
    if (!wc_crypto_gateway_validate_address($payout_address, $settlement_network)) {
        wp_send_json_error(array('message' => __('Invalid payout address format.', 'wc-crypto-gateway')));
        return;
    }

    try {
        // Create a temporary client for registration
        $client = new WC_Crypto_API_Client($api_url, '', '');

        $result = $client->register_merchant(array(
            'store_name'          => sanitize_text_field(get_bloginfo('name')),
            'store_url'           => esc_url_raw(home_url()),
            'settlement_currency' => $settlement_currency,
            'settlement_network'  => $settlement_network,
            'payout_address'      => $payout_address,
            'payout_memo'         => $payout_memo,
            'test_mode'           => false,
        ));

        if (isset($result['merchant']) && isset($result['merchant']['api_key']) && isset($result['merchant']['api_secret'])) {
            wp_send_json_success(array(
                'api_key'    => sanitize_text_field($result['merchant']['api_key']),
                'api_secret' => sanitize_text_field($result['merchant']['api_secret']),
            ));
        } else {
            wp_send_json_error(array('message' => __('Unexpected response from server.', 'wc-crypto-gateway')));
        }
    } catch (Exception $e) {
        error_log('SafePay registration error: ' . $e->getMessage());
        wp_send_json_error(array('message' => __('Registration failed. Please try again.', 'wc-crypto-gateway')));
    }
});
