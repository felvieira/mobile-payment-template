// ============================================
// QUICK PAYMENT CREATE ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/services'
import { createQuickPaymentSchema, validateBody } from '@/lib/validations'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'
import { PaymentError, PaymentProvider } from '@/types'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting
  const rateLimit = checkRateLimit(request, { ...RATE_LIMITS.payment, keyPrefix: 'quick' })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  // Parse and validate body
  const body = await request.json()
  const validation = validateBody(createQuickPaymentSchema, body)

  if (!validation.success) {
    log.warn('Validation failed', { error: validation.error })
    return errorResponse(validation.error, 400, 'VALIDATION_ERROR')
  }

  const input = validation.data

  log.info('Creating quick payment', {
    provider: input.paymentProvider,
    amount: input.amount,
    email: input.customerEmail,
    description: input.description,
  })

  try {
    const result = await paymentService.createQuickPayment(
      input.paymentProvider as PaymentProvider,
      {
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerTaxId: input.customerTaxId,
        metadata: input.metadata,
      }
    )

    log.info('Quick payment created', {
      orderId: result.orderId,
      provider: result.provider,
      amount: result.amount,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PaymentError) {
      log.error('Payment error', error, { code: error.code })
      return errorResponse(error.message, 400, error.code)
    }
    throw error
  }
}

export const POST = withErrorHandler(handler)
