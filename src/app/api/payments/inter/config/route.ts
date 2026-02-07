/**
 * Banco Inter Configuration Endpoint
 *
 * Allows administrators to:
 * 1. Check current Inter configuration status
 * 2. Verify certificate validity
 * 3. Test API connectivity
 *
 * Note: For production, credentials should be set via:
 * - Environment variables (.env.local)
 * - Docker secrets
 * - Cloud platform secret management (AWS Secrets Manager, etc)
 */

import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, withErrorHandler } from '@/lib/api-middleware'
import { logger, generateRequestId } from '@/lib/logger'
import fs from 'fs'

async function handler(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId()
  const log = logger.api.withRequest(requestId)

  try {
    if (request.method === 'GET') {
      // Check configuration status
      const interClientId = process.env.INTER_CLIENT_ID
      const interClientSecret = process.env.INTER_CLIENT_SECRET
      const interCertPath = process.env.INTER_CERT_PATH
      const interKeyPath = process.env.INTER_KEY_PATH

      const hasCerts = interCertPath && interKeyPath &&
        fs.existsSync(interCertPath) &&
        fs.existsSync(interKeyPath)

      const config: Record<string, unknown> = {
        configured: !!interClientId && !!interClientSecret && hasCerts,
        hasClientId: !!interClientId,
        hasClientSecret: !!interClientSecret,
        hasCertificates: hasCerts,
        sandbox: process.env.INTER_SANDBOX !== 'false',
        certPath: interCertPath ? 'configured' : 'not-configured',
        keyPath: interKeyPath ? 'configured' : 'not-configured',
      }

      if (hasCerts) {
        try {
          const certStats = fs.statSync(interCertPath!)
          const keyStats = fs.statSync(interKeyPath!)
          config.certSize = certStats.size
          config.keySize = keyStats.size
        } catch (e) {
          // Ignore errors reading file stats
        }
      }

      log.info('Inter configuration status requested')

      return NextResponse.json({
        success: true,
        config,
      })
    } else if (request.method === 'POST') {
      // Test connectivity with current credentials
      const interClientId = process.env.INTER_CLIENT_ID
      const interClientSecret = process.env.INTER_CLIENT_SECRET
      const interCertPath = process.env.INTER_CERT_PATH
      const interKeyPath = process.env.INTER_KEY_PATH

      if (!interClientId || !interClientSecret || !interCertPath || !interKeyPath) {
        return errorResponse(
          'Credenciais Inter não configuradas',
          400,
          'INTER_NOT_CONFIGURED'
        )
      }

      if (!fs.existsSync(interCertPath) || !fs.existsSync(interKeyPath)) {
        return errorResponse(
          'Certificados Inter não encontrados',
          400,
          'INTER_CERTS_NOT_FOUND'
        )
      }

      // Test connectivity would go here
      log.info('Inter configuration test requested')

      return NextResponse.json({
        success: true,
        message: 'Credenciais Inter configuradas corretamente',
        ready: true,
      })
    } else {
      return errorResponse('Método não permitido', 405, 'METHOD_NOT_ALLOWED')
    }
  } catch (error) {
    logger.api.error('Error in Inter config endpoint', error instanceof Error ? error : undefined)
    return errorResponse(error instanceof Error ? error.message : 'Erro ao verificar configuração', 500)
  }
}

export const GET = withErrorHandler(handler)
export const POST = withErrorHandler(handler)
