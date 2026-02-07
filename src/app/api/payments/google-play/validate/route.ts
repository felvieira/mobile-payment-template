// ============================================
// GOOGLE PLAY PURCHASE VALIDATION ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { googlePlayValidationSchema, validateBody } from '@/lib/validations'
import { errorResponse, withErrorHandler, successResponse } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'
import { googlePlayProvider } from '@/lib/payment-providers'
import { PaymentError } from '@/types'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting
  const rateLimit = checkRateLimit(request, { ...RATE_LIMITS.payment, keyPrefix: 'google-play' })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  if (!googlePlayProvider.isConfigured()) {
    return errorResponse('Google Play não está configurado', 500, 'CONFIGURATION_ERROR')
  }

  // Parse and validate body
  const body = await request.json()
  const validation = validateBody(googlePlayValidationSchema, body)

  if (!validation.success) {
    log.warn('Validation failed', { error: validation.error })
    return errorResponse(validation.error, 400, 'VALIDATION_ERROR')
  }

  const { productId, purchaseToken, packageName } = validation.data
  const isSubscription = body.isSubscription !== false // default to true

  log.info('Validating Google Play purchase', {
    productId,
    packageName,
    isSubscription,
  })

  try {
    const result = await googlePlayProvider.validatePurchase(
      packageName,
      productId,
      purchaseToken,
      isSubscription
    )

    log.info('Google Play validation result', {
      valid: result.valid,
      orderId: result.orderId,
    })

    return successResponse(result)
  } catch (error) {
    if (error instanceof PaymentError) {
      log.error('Google Play validation error', error, { code: error.code })
      return errorResponse(error.message, 400, error.code)
    }
    throw error
  }
}

export const POST = withErrorHandler(handler)
