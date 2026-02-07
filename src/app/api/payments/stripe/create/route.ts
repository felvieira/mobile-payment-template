// ============================================
// STRIPE PAYMENT CREATE ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/services'
import { createPaymentSchema, validateBody } from '@/lib/validations'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'
import { PaymentError } from '@/types'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting
  const rateLimit = checkRateLimit(request, { ...RATE_LIMITS.payment, keyPrefix: 'stripe' })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  // Parse and validate body
  const body = await request.json()
  const validation = validateBody(createPaymentSchema, body)

  if (!validation.success) {
    log.warn('Validation failed', { error: validation.error })
    return errorResponse(validation.error, 400, 'VALIDATION_ERROR')
  }

  const input = validation.data

  log.info('Creating Stripe payment', {
    productId: input.productId,
    email: input.customerEmail,
  })

  try {
    const result = await paymentService.createPayment('STRIPE', input)

    log.info('Stripe payment created', {
      orderId: result.orderId,
      amount: result.amount,
    })

    // Return flat response for backward compatibility
    return NextResponse.json({
      orderId: result.orderId,
      clientSecret: result.clientSecret,
      amount: result.amount,
      currency: result.currency,
    })
  } catch (error) {
    if (error instanceof PaymentError) {
      log.error('Payment error', error, { code: error.code })
      return errorResponse(error.message, 400, error.code)
    }
    throw error
  }
}

export const POST = withErrorHandler(handler)
