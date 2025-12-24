// ============================================
// PIX PAYMENT CREATE ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/services'
import { pixPaymentSchema, validateBody } from '@/lib/validations'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'
import { PaymentError } from '@/types'

async function handler(request: NextRequest) {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting
  const rateLimit = checkRateLimit(request, { ...RATE_LIMITS.payment, keyPrefix: 'pix' })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  // Parse and validate body
  const body = await request.json()
  const validation = validateBody(pixPaymentSchema, body)

  if (!validation.success) {
    log.warn('Validation failed', { error: validation.error })
    return errorResponse(validation.error, 400, 'VALIDATION_ERROR')
  }

  const input = validation.data

  log.info('Creating PIX payment', {
    productId: input.productId,
    email: input.customerEmail,
  })

  try {
    const result = await paymentService.createPayment('ABACATEPAY', {
      productId: input.productId,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerTaxId: input.customerTaxId,
      metadata: input.metadata,
    })

    log.info('PIX payment created', {
      orderId: result.orderId,
      pixId: result.pixId,
      amount: result.amount,
    })

    // Return flat response for backward compatibility
    return NextResponse.json({
      orderId: result.orderId,
      pixId: result.pixId,
      brCode: result.brCode,
      brCodeBase64: result.brCodeBase64,
      status: result.status,
      expiresAt: result.expiresAt,
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
