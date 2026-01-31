// Rate limiting utility for API protection
// Uses in-memory storage (for Vercel serverless, consider using Redis/Upstash for production)

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets on cold start - use Redis for persistent rate limiting)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

/**
 * Default rate limits for different endpoints
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // API endpoints
  'checkout-create': { windowMs: 60000, maxRequests: 10 },
  'checkout-swap': { windowMs: 60000, maxRequests: 20 },
  'checkout-status': { windowMs: 60000, maxRequests: 60 },
  'merchant-register': { windowMs: 3600000, maxRequests: 5 }, // 5 per hour
  'merchant-settings': { windowMs: 60000, maxRequests: 30 },
  'coins': { windowMs: 60000, maxRequests: 30 },
  
  // Default
  'default': { windowMs: 60000, maxRequests: 100 },
};

/**
 * Check if request is rate limited
 * 
 * @param key - Unique identifier (e.g., IP + endpoint)
 * @param config - Rate limit configuration
 * @returns Object with allowed status and remaining info
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries();
  }
  
  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }
  
  // Increment count
  entry.count++;
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  // Check various headers for real IP (behind proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Vercel-specific
  const vercelIP = request.headers.get('x-vercel-forwarded-for');
  if (vercelIP) {
    return vercelIP.split(',')[0].trim();
  }
  
  return 'unknown';
}

/**
 * Create rate limit key from request
 */
export function createRateLimitKey(request: Request, endpoint: string): string {
  const ip = getClientIP(request);
  return `${endpoint}:${ip}`;
}

/**
 * Clean up expired entries to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Rate limit response helper
 */
export function rateLimitResponse(resetTime: number): Response {
  const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
  
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
      },
    }
  );
}
