// ============================================
// GOOGLE PLAY RTDN WEBHOOK ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/services'
import { withErrorHandler, successResponse } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.webhook.withRequest(requestId)

  // Rate limiting (more permissive for webhooks)
  const rateLimit = checkRateLimit(request, { ...RATE_LIMITS.webhook, keyPrefix: 'google-play-wh' })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded for webhook')
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = await request.json()

  log.info('Received Google Play RTDN', {
    hasMessage: !!(body as Record<string, unknown>).message,
  })

  try {
    const result = await paymentService.processWebhook('GOOGLE_PLAY', body)

    log.info('Google Play webhook processed', {
      success: result.success,
      orderId: result.orderId,
      newStatus: result.newStatus,
    })

    return successResponse(result)
  } catch (error) {
    log.error('Google Play webhook error', error instanceof Error ? error : undefined)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 500 }
    )
  }
}

export const POST = withErrorHandler(handler)
