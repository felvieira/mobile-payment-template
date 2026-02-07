// ============================================
// ERROR HANDLING UTILITIES
// ============================================

import { NextResponse } from 'next/server'
import { PaymentError, PaymentErrorCode } from '@/types'

/**
 * Standard API error response
 */
export interface ApiError {
  error: string
  code?: PaymentErrorCode
  details?: unknown
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  code?: PaymentErrorCode,
  details?: unknown
): NextResponse<ApiError> {
  console.error(`[API Error] ${code || 'UNKNOWN'}: ${message}`, details)

  return NextResponse.json(
    {
      error: message,
      code,
      details: process.env.NODE_ENV === 'development' ? details : undefined,
    },
    { status }
  )
}

/**
 * Handle PaymentError and convert to API response
 */
export function handlePaymentError(error: unknown): NextResponse<ApiError> {
  if (error instanceof PaymentError) {
    const statusMap: Record<PaymentErrorCode, number> = {
      PRODUCT_NOT_FOUND: 404,
      PRODUCT_INACTIVE: 400,
      INVALID_INPUT: 400,
      PROVIDER_ERROR: 502,
      WEBHOOK_INVALID_SIGNATURE: 401,
      WEBHOOK_PROCESSING_ERROR: 500,
      ORDER_NOT_FOUND: 404,
      ORDER_ALREADY_PAID: 400,
      CONFIGURATION_ERROR: 500,
      GOOGLE_PLAY_VALIDATION_ERROR: 400,
      INTER_CERT_NOT_FOUND: 500,
      INTER_KEY_NOT_FOUND: 500,
      INTER_NOT_INITIALIZED: 500,
      INTER_API_ERROR: 502,
      CONFIG_MISSING: 500,
      OAUTH_PARSE_ERROR: 502,
      OAUTH_FAILED: 502,
      OAUTH_CONNECTION_ERROR: 502,
      AUTH_ERROR: 500,
      PARSE_ERROR: 502,
      CONNECTION_ERROR: 502,
    }

    return createErrorResponse(
      error.message,
      statusMap[error.code] || 500,
      error.code,
      error.details
    )
  }

  if (error instanceof Error) {
    return createErrorResponse(error.message, 500)
  }

  return createErrorResponse('Erro desconhecido', 500)
}

/**
 * Log error with context
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString()
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  console.error(JSON.stringify({
    timestamp,
    context,
    error: errorMessage,
    stack: errorStack,
    ...metadata,
  }, null, 2))
}

/**
 * Wrap async handler with error handling
 */
export function withErrorHandling<T extends unknown[], R>(
  handler: (...args: T) => Promise<R>,
  context: string
) {
  return async (...args: T): Promise<R | NextResponse<ApiError>> => {
    try {
      return await handler(...args)
    } catch (error) {
      logError(context, error)
      return handlePaymentError(error)
    }
  }
}
