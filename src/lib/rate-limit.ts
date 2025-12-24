// ============================================
// RATE LIMITING
// ============================================

import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
  /** Key prefix for different rate limit buckets */
  keyPrefix?: string
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // General API calls
  api: { limit: 100, windowSeconds: 60 },
  // Payment creation (more restrictive)
  payment: { limit: 10, windowSeconds: 60 },
  // Webhook endpoints (more permissive)
  webhook: { limit: 200, windowSeconds: 60 },
  // Admin endpoints
  admin: { limit: 50, windowSeconds: 60 },
} as const

/**
 * Get client identifier from request
 */
function getClientId(req: NextRequest): string {
  // Try to get real IP from common headers
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = req.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a hash of user-agent + path
  const ua = req.headers.get('user-agent') || 'unknown'
  return `ua:${ua.slice(0, 50)}`
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): { allowed: boolean; remaining: number; resetIn: number } {
  const clientId = getClientId(req)
  const key = `${config.keyPrefix || 'default'}:${clientId}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  let entry = rateLimitStore.get(key)

  // If no entry or expired, create new one
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(key, entry)
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    }
  }

  // Increment count
  entry.count++
  rateLimitStore.set(key, entry)

  const remaining = Math.max(0, config.limit - entry.count)
  const resetIn = Math.ceil((entry.resetTime - now) / 1000)

  return {
    allowed: entry.count <= config.limit,
    remaining,
    resetIn,
  }
}

/**
 * Rate limit middleware for API routes
 */
export function withRateLimit(
  config: RateLimitConfig = RATE_LIMITS.api
) {
  return function <T>(
    handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
  ) {
    return async (req: NextRequest, context?: any): Promise<NextResponse<T | { error: string }>> => {
      const result = checkRateLimit(req, config)

      // Add rate limit headers
      const headers = {
        'X-RateLimit-Limit': String(config.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetIn),
      }

      if (!result.allowed) {
        return NextResponse.json(
          { error: 'Taxa de requisições excedida. Tente novamente em breve.' },
          { status: 429, headers }
        ) as NextResponse<T | { error: string }>
      }

      const response = await handler(req, context)

      // Add headers to successful response
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })

      return response
    }
  }
}

/**
 * Reset rate limit for a specific key (useful for testing)
 */
export function resetRateLimit(clientId: string, keyPrefix = 'default'): void {
  rateLimitStore.delete(`${keyPrefix}:${clientId}`)
}

/**
 * Get current rate limit status
 */
export function getRateLimitStatus(
  req: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api
): { count: number; limit: number; remaining: number } {
  const clientId = getClientId(req)
  const key = `${config.keyPrefix || 'default'}:${clientId}`
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetTime < Date.now()) {
    return { count: 0, limit: config.limit, remaining: config.limit }
  }

  return {
    count: entry.count,
    limit: config.limit,
    remaining: Math.max(0, config.limit - entry.count),
  }
}
