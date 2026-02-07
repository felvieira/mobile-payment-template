/**
 * Banco Inter Payout Service
 *
 * Handles direct payments via Banco Inter API v3
 * Enables automatic fund transfers using user's Inter account
 *
 * Features:
 * - OAuth 2.0 authentication with mTLS
 * - Direct PIX transfers to any key (CPF, Email, Phone, EVP)
 * - Idempotency to prevent duplicate payments
 * - Support for batch transfers
 * - Real-time status updates via webhooks
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { PaymentError } from '@/types'
import { logger } from '@/lib/logger'

export interface InterConfig {
  clientId: string
  clientSecret: string
  certPath: string
  keyPath: string
  sandbox?: boolean
}

export interface PayoutRequest {
  amount: number // in cents
  pixKey: string // CPF, Email, Telefone, EVP
  description: string
  idempotencyKey?: string
  metadata?: Record<string, any>
}

export interface PayoutResponse {
  transferId: string
  status: 'completed' | 'pending' | 'failed'
  amount: number
  pixKey: string
  idempotencyKey: string
  createdAt: string
  error?: string
}

interface InterTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

/**
 * Banco Inter Payout Service
 * Handles payments via Banco Inter API
 */
export class InterPayoutService {
  private config: InterConfig | null = null
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private baseUrl: string = 'https://api.inter.co'
  private sandboxUrl: string = 'https://sandbox-api.inter.co'

  /**
   * Initialize service with Inter credentials
   */
  async initialize(config: InterConfig): Promise<void> {
    this.config = config

    // Set base URL based on sandbox flag
    this.baseUrl = config.sandbox ? this.sandboxUrl : 'https://api.inter.co'

    // Validate certificate files
    if (!fs.existsSync(config.certPath)) {
      throw new PaymentError(
        `Certificado não encontrado: ${config.certPath}`,
        'INTER_CERT_NOT_FOUND'
      )
    }
    if (!fs.existsSync(config.keyPath)) {
      throw new PaymentError(
        `Chave privada não encontrada: ${config.keyPath}`,
        'INTER_KEY_NOT_FOUND'
      )
    }

    logger.payment.info('Inter Payout Service initialized', {
      sandbox: config.sandbox,
      baseUrl: this.baseUrl,
    })
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  private async getAccessToken(): Promise<string> {
    if (!this.config) {
      throw new PaymentError('Serviço Inter não inicializado', 'INTER_NOT_INITIALIZED')
    }

    // Check if current token is still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    logger.payment.info('Requesting new Inter API token')
    const token = await this.authenticateOAuth2()
    this.accessToken = token.access_token
    this.tokenExpiresAt = Date.now() + (token.expires_in - 60) * 1000
    return this.accessToken
  }

  /**
   * OAuth 2.0 Client Credentials flow
   */
  private authenticateOAuth2(): Promise<InterTokenResponse> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        reject(new PaymentError('Config não disponível', 'CONFIG_MISSING'))
        return
      }

      try {
        const certBuffer = fs.readFileSync(this.config.certPath)
        const keyBuffer = fs.readFileSync(this.config.keyPath)

        const agent = new https.Agent({
          cert: certBuffer,
          key: keyBuffer,
          rejectUnauthorized: true,
        })

        const auth = Buffer.from(
          `${this.config.clientId}:${this.config.clientSecret}`
        ).toString('base64')

        const hostname = this.baseUrl.replace('https://', '')
        const options = {
          hostname,
          port: 443,
          path: '/oauth/v2/token',
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          agent,
        }

        const req = https.request(options, (res) => {
          let data = ''

          res.on('data', (chunk) => {
            data += chunk
          })

          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const response = JSON.parse(data)
                resolve(response)
              } catch (e) {
                reject(new PaymentError(`Erro ao fazer parse da resposta OAuth: ${data}`, 'OAUTH_PARSE_ERROR'))
              }
            } else {
              reject(
                new PaymentError(`OAuth falhou: ${res.statusCode} - ${data}`, 'OAUTH_FAILED')
              )
            }
          })
        })

        req.on('error', (error) => {
          reject(new PaymentError(`Erro de conexão OAuth: ${error.message}`, 'OAUTH_CONNECTION_ERROR'))
        })

        req.write('grant_type=client_credentials&scope=pix.write pix.read')
        req.end()
      } catch (error: any) {
        reject(new PaymentError(`Erro ao autenticar: ${error.message}`, 'AUTH_ERROR'))
      }
    })
  }

  /**
   * Make authenticated HTTPS request to Inter API
   */
  private async makeRequest<T>(
    method: string,
    pathStr: string,
    body?: any
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        if (!this.config) {
          reject(new PaymentError('Config não disponível', 'CONFIG_MISSING'))
          return
        }

        const token = await this.getAccessToken()
        const certBuffer = fs.readFileSync(this.config.certPath)
        const keyBuffer = fs.readFileSync(this.config.keyPath)

        const agent = new https.Agent({
          cert: certBuffer,
          key: keyBuffer,
          rejectUnauthorized: true,
        })

        const bodyString = body ? JSON.stringify(body) : undefined
        const hostname = this.baseUrl.replace('https://', '')

        const options = {
          hostname,
          port: 443,
          path: pathStr,
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(bodyString && { 'Content-Length': Buffer.byteLength(bodyString) }),
          },
          agent,
        }

        const req = https.request(options, (res) => {
          let data = ''

          res.on('data', (chunk) => {
            data += chunk
          })

          res.on('end', () => {
            try {
              if (data) {
                const response = JSON.parse(data)
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(response)
                } else {
                  reject(
                    new PaymentError(
                      `Erro da API Inter ${res.statusCode}: ${JSON.stringify(response)}`,
                      'INTER_API_ERROR'
                    )
                  )
                }
              } else {
                resolve({} as T)
              }
            } catch (e) {
              reject(new PaymentError(`Erro ao fazer parse da resposta: ${data}`, 'PARSE_ERROR'))
            }
          })
        })

        req.on('error', (error) => {
          reject(
            new PaymentError(
              `Erro de conexão com Inter: ${error.message}`,
              'CONNECTION_ERROR'
            )
          )
        })

        if (bodyString) {
          req.write(bodyString)
        }

        req.end()
      } catch (error: any) {
        reject(error)
      }
    })
  }

  /**
   * Send a PIX transfer
   */
  async sendPix(request: PayoutRequest): Promise<PayoutResponse> {
    if (!this.config) {
      throw new PaymentError('Serviço Inter não inicializado', 'INTER_NOT_INITIALIZED')
    }

    const idempotencyKey = request.idempotencyKey || crypto.randomUUID()

    logger.payment.info('Sending PIX via Inter', {
      amount: request.amount,
      pixKey: request.pixKey,
      idempotencyKey,
    })

    try {
      const requestBody = {
        idempotencyKey,
        amount: request.amount,
        description: request.description,
        dict: {
          key: request.pixKey,
        },
      }

      const response = await this.makeRequest<any>(
        'POST',
        '/pix/v2/transfers',
        requestBody
      )

      logger.payment.info('PIX sent successfully', {
        transferId: response.id,
        status: response.status,
      })

      return {
        transferId: response.id,
        status: response.status || 'completed',
        amount: response.amount,
        pixKey: response.recipientDictKey,
        idempotencyKey,
        createdAt: new Date().toISOString(),
      }
    } catch (error: any) {
      logger.payment.error('PIX send failed', error)
      throw error
    }
  }

  /**
   * Check transfer status
   */
  async getTransferStatus(transferId: string): Promise<PayoutResponse> {
    logger.payment.info('Checking transfer status', { transferId })

    try {
      const response = await this.makeRequest<any>(
        'GET',
        `/pix/v2/transfers/${transferId}`
      )

      return {
        transferId: response.id,
        status: response.status,
        amount: response.amount,
        pixKey: response.recipientDictKey,
        idempotencyKey: response.idempotencyKey,
        createdAt: response.createdAt,
      }
    } catch (error: any) {
      logger.payment.error('Failed to check transfer status', error)
      throw error
    }
  }

  /**
   * Get account balance
   */
  async getAccountBalance(): Promise<any> {
    logger.payment.info('Fetching account balance')

    try {
      return await this.makeRequest('GET', '/account/v1/balance')
    } catch (error: any) {
      logger.payment.error('Failed to fetch account balance', error)
      throw error
    }
  }
}

// Singleton instance
export const interPayoutService = new InterPayoutService()

export default interPayoutService
