// ============================================
// ABACATE PAY (PIX) PAYMENT PROVIDER
// ============================================

import crypto from 'crypto'
import { Order, Product } from '@prisma/client'
import { IPaymentProvider, CustomerInfo } from './base'
import { PaymentProvider, PaymentMethod, PaymentResult, WebhookResult } from '@/types'
import { formatTaxId } from '@/utils'
import { PIX_EXPIRATION_MINUTES } from '@/constants'

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1'

export class AbacatePayProvider implements IPaymentProvider {
  readonly name: PaymentProvider = 'ABACATEPAY'
  readonly supportedMethods: PaymentMethod[] = ['PIX']

  isConfigured(): boolean {
    return !!process.env.ABACATEPAY_API_KEY
  }

  private getApiKey(): string {
    const apiKey = process.env.ABACATEPAY_API_KEY
    if (!apiKey) {
      throw new Error('ABACATEPAY_API_KEY não configurado')
    }
    return apiKey
  }

  async createPayment(
    order: Order,
    product: Product,
    customerInfo: CustomerInfo
  ): Promise<PaymentResult> {
    const apiKey = this.getApiKey()

    // Calculate expiration
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + PIX_EXPIRATION_MINUTES)

    const payload = {
      amount: order.amount, // AbacatePay expects cents
      expiresIn: PIX_EXPIRATION_MINUTES * 60, // in seconds
      description: `Pagamento: ${product.name}`,
      customer: {
        name: customerInfo.name || customerInfo.email.split('@')[0],
        email: customerInfo.email,
        taxId: customerInfo.taxId ? formatTaxId(customerInfo.taxId) : undefined,
        cellphone: customerInfo.phone || '5500000000000', // Default placeholder
      },
      externalId: order.id,
    }

    const response = await fetch(`${ABACATEPAY_API_URL}/pixQrCode/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`AbacatePay error: ${error}`)
    }

    const data = await response.json()

    return {
      success: true,
      orderId: order.id,
      provider: 'ABACATEPAY',
      method: 'PIX',
      amount: order.amount,
      currency: order.currency,
      brCode: data.data?.brCode,
      brCodeBase64: data.data?.brCodeBase64,
      pixId: data.data?.id,
      status: data.data?.status || 'pending',
      expiresAt: expiresAt.toISOString(),
    }
  }

  async handleWebhook(
    payload: string | object,
    signature?: string,
  ): Promise<WebhookResult> {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload

    // Validate signature
    if (signature) {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload)
      if (!this.validateWebhookSignature(signature, payloadStr)) {
        return { success: false, error: 'Assinatura inválida' }
      }
    }

    // Extract order ID from webhook data
    const orderId = data.data?.externalId || data.externalId

    if (!orderId) {
      return { success: false, error: 'Order ID não encontrado' }
    }

    // Check payment status
    const status = data.data?.status || data.status
    let newStatus: 'PAID' | 'FAILED' | undefined

    if (status === 'PAID' || status === 'paid') {
      newStatus = 'PAID'
    } else if (status === 'EXPIRED' || status === 'expired') {
      newStatus = 'FAILED'
    }

    return {
      success: true,
      orderId,
      newStatus,
      message: `PIX status: ${status}`,
    }
  }

  validateWebhookSignature(signature: string, payload: string): boolean {
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.warn('ABACATEPAY_WEBHOOK_SECRET não configurado')
      return false
    }

    const calculatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex')

    // Timing-safe comparison
    if (calculatedSignature.length !== signature.length) return false

    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(signature)
    )
  }

  /**
   * Check PIX payment status (for polling)
   */
  async checkPaymentStatus(orderId: string): Promise<{
    status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
    paidAt?: Date
  }> {
    // Note: This requires looking up the PIX ID from the order
    // In a real implementation, you'd store the pixId in the order metadata
    return { status: 'PENDING' }
  }

  /**
   * Simulate PIX payment (development only)
   */
  async simulatePayment(pixId: string): Promise<void> {
    const apiKey = this.getApiKey()

    const response = await fetch(
      `${ABACATEPAY_API_URL}/pixQrCode/simulate-payment?id=${pixId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erro ao simular pagamento: ${error}`)
    }
  }
}

/**
 * Singleton instance
 */
export const abacatePayProvider = new AbacatePayProvider()
