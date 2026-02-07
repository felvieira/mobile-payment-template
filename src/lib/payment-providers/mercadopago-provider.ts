// ============================================
// MERCADO PAGO PAYMENT PROVIDER
// ============================================

import crypto from 'crypto'
import { Order, Product } from '@prisma/client'
import { IPaymentProvider, CustomerInfo } from './base'
import { PaymentProvider, PaymentMethod, PaymentResult, WebhookResult } from '@/types'
import { centsToDecimal } from '@/utils'

const MERCADOPAGO_API_URL = 'https://api.mercadopago.com'

export class MercadoPagoProvider implements IPaymentProvider {
  readonly name: PaymentProvider = 'MERCADOPAGO'
  readonly supportedMethods: PaymentMethod[] = ['CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO']

  isConfigured(): boolean {
    return !!process.env.MERCADOPAGO_ACCESS_TOKEN
  }

  private getAccessToken(): string {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!token) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
    }
    return token
  }

  private getBaseUrl(): string {
    // Use environment variable or auto-detect
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL
    }
    // Default for development
    return 'http://localhost:3000'
  }

  async createPayment(
    order: Order,
    product: Product | null,
    customerInfo: CustomerInfo
  ): Promise<PaymentResult> {
    const accessToken = this.getAccessToken()
    const baseUrl = this.getBaseUrl()

    const itemTitle = product?.name || (order.metadata as Record<string, unknown>)?.description as string || `Pagamento #${order.id.slice(0, 8)}`
    const itemDescription = product?.description || itemTitle
    const failureUrl = product
      ? `${baseUrl}/checkout/${product.id}?error=payment_failed`
      : `${baseUrl}/quick-checkout?error=payment_failed`

    const preference = {
      items: [
        {
          id: product?.id || order.id,
          title: itemTitle,
          description: itemDescription,
          quantity: 1,
          currency_id: order.currency,
          unit_price: centsToDecimal(order.amount),
          category_id: 'services',
        },
      ],
      payer: {
        email: customerInfo.email,
        name: customerInfo.name || undefined,
      },
      external_reference: order.id,
      back_urls: {
        success: `${baseUrl}/success?orderId=${order.id}`,
        failure: failureUrl,
        pending: `${baseUrl}/success?orderId=${order.id}&status=pending`,
      },
      auto_return: 'approved' as const,
      notification_url: `${baseUrl}/api/payments/mercadopago/webhook`,
      statement_descriptor: 'Payment Hub',
    }

    const response = await fetch(`${MERCADOPAGO_API_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Mercado Pago error: ${error}`)
    }

    const data = await response.json()

    return {
      success: true,
      orderId: order.id,
      provider: 'MERCADOPAGO',
      method: 'CREDIT_CARD',
      amount: order.amount,
      currency: order.currency,
      preferenceId: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    }
  }

  async handleWebhook(
    payload: string | object,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<WebhookResult> {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload

    // Validate signature if provided
    if (signature && headers) {
      const isValid = this.validateWebhookSignatureInternal(
        signature,
        typeof payload === 'string' ? payload : JSON.stringify(payload),
        headers
      )
      if (!isValid) {
        console.warn('Mercado Pago: assinatura inválida, mas continuando...')
        // Note: In production, you might want to reject invalid signatures
        // return { success: false, error: 'Assinatura inválida' }
      }
    }

    // Handle different notification types
    if (data.type === 'payment') {
      return this.handlePaymentNotification(data.data?.id)
    }

    if (data.action === 'payment.created' || data.action === 'payment.updated') {
      return this.handlePaymentNotification(data.data?.id)
    }

    return { success: true, message: 'Evento ignorado' }
  }

  private async handlePaymentNotification(paymentId: string): Promise<WebhookResult> {
    if (!paymentId) {
      return { success: false, error: 'Payment ID ausente' }
    }

    const accessToken = this.getAccessToken()

    // Fetch payment details from Mercado Pago
    const response = await fetch(`${MERCADOPAGO_API_URL}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return { success: false, error: 'Erro ao buscar pagamento' }
    }

    const payment = await response.json()
    const orderId = payment.external_reference

    if (!orderId) {
      return { success: false, error: 'Order ID não encontrado' }
    }

    // Map Mercado Pago status to our status
    let newStatus: 'PAID' | 'FAILED' | undefined
    if (payment.status === 'approved') {
      newStatus = 'PAID'
    } else if (['rejected', 'cancelled'].includes(payment.status)) {
      newStatus = 'FAILED'
    }

    return {
      success: true,
      orderId,
      newStatus,
      message: `Status: ${payment.status}`,
    }
  }

  validateWebhookSignature(signature: string, payload: string): boolean {
    // Basic validation - in production, use HMAC validation
    return this.validateWebhookSignatureInternal(signature, payload, {})
  }

  private validateWebhookSignatureInternal(
    signature: string,
    payload: string,
    headers: Record<string, string>
  ): boolean {
    const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET

    // If no secret configured, skip validation (not recommended for production)
    if (!webhookSecret) {
      console.warn('MERCADOPAGO_WEBHOOK_SECRET não configurado - validação ignorada')
      return true
    }

    // Mercado Pago sends x-signature header with format: ts=xxx,v1=xxx
    const xSignature = headers['x-signature'] || signature
    if (!xSignature) return false

    const xRequestId = headers['x-request-id'] || ''
    const dataId = headers['data-id'] || ''

    // Parse signature header
    const parts = xSignature.split(',')
    const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
    const hash = parts.find(p => p.startsWith('v1='))?.split('=')[1]

    if (!ts || !hash) return false

    // Build manifest string
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`

    // Calculate HMAC
    const calculatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(manifest)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature),
      Buffer.from(hash)
    )
  }
}

/**
 * Singleton instance
 */
export const mercadoPagoProvider = new MercadoPagoProvider()
