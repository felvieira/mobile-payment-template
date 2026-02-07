/**
 * Banco Inter Direct Payout Endpoint
 *
 * This endpoint enables direct PIX transfers using a configured
 * Banco Inter account. Users can send money directly to any PIX key
 * without generating checkout codes.
 *
 * Use Cases:
 * - Automatic bill payments
 * - Salary distributions
 * - Refunds
 * - Direct payments to suppliers
 * - Integration with automation platforms
 *
 * Security:
 * - Requires Inter API credentials (Client ID, Secret, Certificates)
 * - OAuth 2.0 + mTLS authentication
 * - Idempotency keys prevent duplicate payments
 * - Rate limiting to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server'
import { interPayoutService } from '@/services'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, generateRequestId } from '@/lib/logger'
import { PaymentError } from '@/types'
import fs from 'fs'
import path from 'path'

interface InterPayoutRequest {
  amount: number // in cents
  pixKey: string // CPF, Email, Telefone, EVP
  description: string
  idempotencyKey?: string
  metadata?: Record<string, any>
}

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.payment.withRequest(requestId)

  // Rate limiting
  const rateLimit = checkRateLimit(request, {
    ...RATE_LIMITS.payment,
    keyPrefix: 'inter-payout',
  })
  if (!rateLimit.allowed) {
    log.warn('Rate limit exceeded')
    return errorResponse('Taxa de requisições excedida', 429, 'RATE_LIMIT_EXCEEDED')
  }

  try {
    // Parse body
    const body = (await request.json()) as InterPayoutRequest

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      log.warn('Invalid amount', { amount: body.amount })
      return errorResponse('Valor inválido (deve ser maior que 0)', 400, 'INVALID_AMOUNT')
    }

    if (!body.pixKey || typeof body.pixKey !== 'string') {
      log.warn('Missing or invalid pixKey')
      return errorResponse('Chave PIX inválida', 400, 'INVALID_PIX_KEY')
    }

    if (!body.description || typeof body.description !== 'string') {
      log.warn('Missing description')
      return errorResponse('Descrição obrigatória', 400, 'MISSING_DESCRIPTION')
    }

    // Check if Inter credentials are configured
    const interCertPath = process.env.INTER_CERT_PATH
    const interKeyPath = process.env.INTER_KEY_PATH
    const interClientId = process.env.INTER_CLIENT_ID
    const interClientSecret = process.env.INTER_CLIENT_SECRET

    if (!interClientId || !interClientSecret) {
      log.error('Inter credentials not configured')
      return errorResponse(
        'Credenciais Banco Inter não configuradas no servidor',
        500,
        'INTER_NOT_CONFIGURED'
      )
    }

    if (!interCertPath || !interKeyPath) {
      log.error('Inter certificates not found')
      return errorResponse(
        'Certificados Banco Inter não encontrados',
        500,
        'INTER_CERTS_NOT_FOUND'
      )
    }

    // Check if certificate files exist
    if (!fs.existsSync(interCertPath) || !fs.existsSync(interKeyPath)) {
      log.error('Inter certificate files missing', undefined, { interCertPath, interKeyPath })
      return errorResponse(
        'Certificados Banco Inter inválidos ou expirados',
        500,
        'INTER_CERTS_INVALID'
      )
    }

    // Initialize service if not already done
    await interPayoutService.initialize({
      clientId: interClientId,
      clientSecret: interClientSecret,
      certPath: interCertPath,
      keyPath: interKeyPath,
      sandbox: process.env.INTER_SANDBOX !== 'false',
    })

    log.info('Processing Inter payout request', {
      amount: body.amount,
      pixKey: body.pixKey.substring(0, 5) + '***', // Log only first 5 chars for privacy
    })

    // Send PIX
    const result = await interPayoutService.sendPix({
      amount: body.amount,
      pixKey: body.pixKey,
      description: body.description,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata,
    })

    log.info('Inter payout completed', {
      transferId: result.transferId,
      status: result.status,
    })

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
      status: result.status,
      amount: result.amount,
      pixKey: result.pixKey,
      idempotencyKey: result.idempotencyKey,
      createdAt: result.createdAt,
      message: 'PIX enviado com sucesso via Banco Inter',
    })
  } catch (error) {
    if (error instanceof PaymentError) {
      log.error('Payout error', error, { code: error.code })
      return errorResponse(error.message, 400, error.code)
    }

    log.error('Unexpected error in Inter payout', error instanceof Error ? error : undefined)
    return errorResponse(
      'Erro ao processar pagamento. Tente novamente.',
      500,
      'INTERNAL_ERROR'
    )
  }
}

export const POST = withErrorHandler(handler)
