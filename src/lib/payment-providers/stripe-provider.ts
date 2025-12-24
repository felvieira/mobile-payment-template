// ============================================
// STRIPE PAYMENT PROVIDER
// ============================================

import Stripe from 'stripe'
import { Order, Product } from '@prisma/client'
import { IPaymentProvider, CustomerInfo } from './base'
import { PaymentProvider, PaymentMethod, PaymentResult, WebhookResult } from '@/types'

export class StripeProvider implements IPaymentProvider {
  readonly name: PaymentProvider = 'STRIPE'
  readonly supportedMethods: PaymentMethod[] = ['CREDIT_CARD', 'DEBIT_CARD']

  private stripe: Stripe | null = null

  private getStripe(): Stripe {
    if (!this.stripe) {
      const secretKey = process.env.STRIPE_SECRET_KEY
      if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY não configurado')
      }
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2025-11-17.clover',
      })
    }
    return this.stripe
  }

  isConfigured(): boolean {
    return !!process.env.STRIPE_SECRET_KEY
  }

  async createPayment(
    order: Order,
    product: Product,
    customerInfo: CustomerInfo
  ): Promise<PaymentResult> {
    const stripe = this.getStripe()

    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.amount,
      currency: order.currency.toLowerCase(),
      metadata: {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        customerEmail: customerInfo.email,
      },
      receipt_email: customerInfo.email,
      description: `Pagamento: ${product.name}`,
    })

    return {
      success: true,
      orderId: order.id,
      provider: 'STRIPE',
      method: 'CREDIT_CARD',
      amount: order.amount,
      currency: order.currency,
      clientSecret: paymentIntent.client_secret || undefined,
    }
  }

  async handleWebhook(
    payload: string | object,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<WebhookResult> {
    const stripe = this.getStripe()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!webhookSecret) {
      return { success: false, error: 'Webhook secret não configurado' }
    }

    // Validate signature
    const sig = signature || headers?.['stripe-signature']
    if (!sig) {
      return { success: false, error: 'Assinatura ausente' }
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload)

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(payloadStr, sig, webhookSecret)
    } catch (err) {
      return { success: false, error: 'Assinatura inválida' }
    }

    // Process event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata?.orderId

      if (!orderId) {
        return { success: false, error: 'Order ID não encontrado no metadata' }
      }

      return {
        success: true,
        orderId,
        newStatus: 'PAID',
        message: 'Pagamento confirmado',
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      const orderId = paymentIntent.metadata?.orderId

      if (!orderId) {
        return { success: false, error: 'Order ID não encontrado no metadata' }
      }

      return {
        success: true,
        orderId,
        newStatus: 'FAILED',
        message: 'Pagamento falhou',
      }
    }

    // Unknown event type
    return { success: true, message: `Evento ignorado: ${event.type}` }
  }

  validateWebhookSignature(signature: string, payload: string): boolean {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) return false

    try {
      this.getStripe().webhooks.constructEvent(payload, signature, webhookSecret)
      return true
    } catch {
      return false
    }
  }

  async refundPayment(orderId: string, amount?: number): Promise<{
    success: boolean
    refundId?: string
  }> {
    // TODO: Implement refund
    // Need to look up the payment intent by order ID and create a refund
    return { success: false }
  }
}

/**
 * Singleton instance
 */
export const stripeProvider = new StripeProvider()
