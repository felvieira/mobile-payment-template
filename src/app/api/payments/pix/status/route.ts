// ============================================
// PIX STATUS CHECK ROUTE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkPixStatus } from '@/lib/abacatepay'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting (more permissive for status checks)
  const rateLimit = checkRateLimit(request, { ...RATE_LIMITS.api, keyPrefix: 'pix-status' })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  const { searchParams } = new URL(request.url)
  const orderId = searchParams.get('orderId')

  if (!orderId) {
    return errorResponse('orderId é obrigatório', 400, 'MISSING_ORDER_ID')
  }

  log.debug('Checking PIX status', { orderId })

  // Fetch order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { product: true },
  })

  if (!order) {
    return errorResponse('Pedido não encontrado', 404, 'ORDER_NOT_FOUND')
  }

  // If already paid, return immediately
  if (order.status === 'PAID') {
    return NextResponse.json({
      orderId: order.id,
      status: 'PAID',
      paidAt: order.paidAt,
    })
  }

  // If expired, return and update status if still pending
  if (order.expiresAt && new Date() > new Date(order.expiresAt)) {
    if (order.status === 'PENDING') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'EXPIRED' },
      })
    }

    return NextResponse.json({
      orderId: order.id,
      status: 'EXPIRED',
      expiresAt: order.expiresAt,
    })
  }

  // Check status with AbacatePay
  if (order.providerPaymentId) {
    const pixStatus = await checkPixStatus(order.providerPaymentId)

    // If paid, update order
    if (pixStatus.status === 'PAID' && order.status === 'PENDING') {
      log.info('PIX payment confirmed', { orderId, pixId: order.providerPaymentId })

      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      })

      await prisma.transaction.create({
        data: {
          orderId: order.id,
          provider: 'ABACATEPAY',
          providerTxId: order.providerPaymentId,
          status: 'paid',
          amount: order.amount,
          rawResponse: { status: pixStatus.status },
        },
      })

      return NextResponse.json({
        orderId: order.id,
        status: 'PAID',
        paidAt: new Date(),
      })
    }

    return NextResponse.json({
      orderId: order.id,
      status: pixStatus.status,
      expiresAt: pixStatus.expiresAt,
    })
  }

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    expiresAt: order.expiresAt,
  })
}

export const GET = withErrorHandler(handler)
