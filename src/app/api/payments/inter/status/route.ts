/**
 * Banco Inter Transfer Status Endpoint
 *
 * Check the status of a PIX transfer made via Inter API
 *
 * Query Parameters:
 * - transferId: ID of the transfer to check
 */

import { NextRequest, NextResponse } from 'next/server'
import { interPayoutService } from '@/services'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'
import { PaymentError } from '@/types'
import fs from 'fs'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting
  const rateLimit = checkRateLimit(request, {
    ...RATE_LIMITS.payment,
    keyPrefix: 'inter-status',
  })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  try {
    // Get transferId from query parameters
    const { searchParams } = new URL(request.url)
    const transferId = searchParams.get('transferId')

    if (!transferId) {
      log.warn('Missing transferId parameter')
      return errorResponse('Parâmetro transferId obrigatório', 400, 'MISSING_TRANSFER_ID')
    }

    // Check if Inter credentials are configured
    const interCertPath = process.env.INTER_CERT_PATH
    const interKeyPath = process.env.INTER_KEY_PATH
    const interClientId = process.env.INTER_CLIENT_ID
    const interClientSecret = process.env.INTER_CLIENT_SECRET

    if (!interClientId || !interClientSecret || !interCertPath || !interKeyPath) {
      log.error('Inter credentials not configured')
      return errorResponse(
        'Credenciais Banco Inter não configuradas',
        500,
        'INTER_NOT_CONFIGURED'
      )
    }

    if (!fs.existsSync(interCertPath) || !fs.existsSync(interKeyPath)) {
      log.error('Inter certificate files missing')
      return errorResponse(
        'Certificados Banco Inter inválidos',
        500,
        'INTER_CERTS_INVALID'
      )
    }

    // Initialize service
    await interPayoutService.initialize({
      clientId: interClientId,
      clientSecret: interClientSecret,
      certPath: interCertPath,
      keyPath: interKeyPath,
      sandbox: process.env.INTER_SANDBOX !== 'false',
    })

    log.info('Checking transfer status', { transferId })

    // Get transfer status
    const result = await interPayoutService.getTransferStatus(transferId)

    log.info('Transfer status retrieved', {
      transferId: result.transferId,
      status: result.status,
    })

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
      status: result.status,
      amount: result.amount,
      pixKey: result.pixKey,
      createdAt: result.createdAt,
    })
  } catch (error) {
    if (error instanceof PaymentError) {
      log.error('Payment error', error, { code: error.code })
      return errorResponse(error.message, 400, error.code)
    }

    log.error('Unexpected error checking transfer status', error instanceof Error ? error : undefined)
    return errorResponse('Erro ao verificar status da transferência', 500, 'INTERNAL_ERROR')
  }
}

export const GET = withErrorHandler(handler)
