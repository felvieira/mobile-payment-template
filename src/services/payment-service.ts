// ============================================
// PAYMENT SERVICE
// ============================================

import { prisma } from '@/lib/db'
import { PaymentMethod as PrismaPaymentMethod, PaymentProvider as PrismaPaymentProvider } from '@prisma/client'
import {
  paymentProviderRegistry,
  stripeProvider,
  mercadoPagoProvider,
  abacatePayProvider,
} from '@/lib/payment-providers'
import {
  CreatePaymentInput,
  PaymentResult,
  PaymentError,
  PaymentProvider,
  WebhookResult,
} from '@/types'
import { validateCreatePaymentInput } from '@/utils'
import { ORDER_STATUS, PAYMENT_PROVIDERS } from '@/constants'

// Register all providers on module load
paymentProviderRegistry.register(stripeProvider)
paymentProviderRegistry.register(mercadoPagoProvider)
paymentProviderRegistry.register(abacatePayProvider)

/**
 * Payment Service - Central business logic for payments
 *
 * This service handles:
 * - Creating payments with any registered provider
 * - Processing webhooks
 * - Checking payment status
 * - Managing payment lifecycle
 */
export class PaymentService {
  /**
   * Create a payment using the specified provider
   */
  async createPayment(
    providerName: PaymentProvider,
    input: CreatePaymentInput
  ): Promise<PaymentResult> {
    // Validate input
    const validation = validateCreatePaymentInput(input)
    if (!validation.valid) {
      throw new PaymentError(
        validation.errors.join(', '),
        'INVALID_INPUT'
      )
    }

    // Get provider
    const provider = paymentProviderRegistry.get(providerName)
    if (!provider.isConfigured()) {
      throw new PaymentError(
        `Provider ${providerName} não está configurado`,
        'CONFIGURATION_ERROR',
        providerName
      )
    }

    // Fetch product
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    })

    if (!product) {
      throw new PaymentError('Produto não encontrado', 'PRODUCT_NOT_FOUND')
    }

    if (!product.active) {
      throw new PaymentError('Produto inativo', 'PRODUCT_INACTIVE')
    }

    // Determine payment method based on provider
    const paymentMethod = this.getPaymentMethodForProvider(providerName)

    // Create order
    const order = await prisma.order.create({
      data: {
        productId: product.id,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerTaxId: input.customerTaxId,
        amount: product.price,
        currency: product.currency,
        status: ORDER_STATUS.PENDING,
        paymentMethod,
        paymentProvider: providerName,
        metadata: input.metadata as any,
      },
    })

    try {
      // Create payment with provider
      const result = await provider.createPayment(order, product, {
        email: input.customerEmail,
        name: input.customerName,
        taxId: input.customerTaxId,
        phone: input.customerPhone,
      })

      // Update order with provider payment ID if available
      if (result.pixId || result.preferenceId || result.clientSecret) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            providerPaymentId: result.pixId || result.preferenceId,
            expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
            metadata: {
              ...(order.metadata as object || {}),
              clientSecret: result.clientSecret,
              pixId: result.pixId,
              brCode: result.brCode,
              preferenceId: result.preferenceId,
            },
          },
        })
      }

      // Create transaction record
      await prisma.transaction.create({
        data: {
          orderId: order.id,
          provider: providerName,
          providerTxId: result.pixId || result.preferenceId || 'pending',
          status: ORDER_STATUS.PENDING,
          amount: order.amount,
          rawResponse: result as any,
        },
      })

      return result
    } catch (error) {
      // Update order to failed
      await prisma.order.update({
        where: { id: order.id },
        data: { status: ORDER_STATUS.FAILED },
      })

      // Log transaction failure
      await prisma.transaction.create({
        data: {
          orderId: order.id,
          provider: providerName,
          providerTxId: 'error',
          status: ORDER_STATUS.FAILED,
          amount: order.amount,
          rawResponse: { error: String(error) },
        },
      })

      throw new PaymentError(
        error instanceof Error ? error.message : 'Erro ao criar pagamento',
        'PROVIDER_ERROR',
        providerName,
        error
      )
    }
  }

  /**
   * Process a webhook from any provider
   */
  async processWebhook(
    providerName: PaymentProvider,
    payload: string | object,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<WebhookResult> {
    const provider = paymentProviderRegistry.get(providerName)

    // Process webhook through provider
    const result = await provider.handleWebhook(payload, signature, headers)

    if (!result.success) {
      return result
    }

    // Update order if status changed
    if (result.orderId && result.newStatus) {
      const order = await prisma.order.findUnique({
        where: { id: result.orderId },
      })

      if (!order) {
        return {
          success: false,
          error: 'Pedido não encontrado',
        }
      }

      // Check idempotency - don't update if already in final state
      if (order.status === 'PAID' && result.newStatus === 'PAID') {
        return {
          success: true,
          message: 'Pagamento já confirmado anteriormente',
        }
      }

      // Update order
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: result.newStatus,
          paidAt: result.newStatus === 'PAID' ? new Date() : undefined,
        },
      })

      // Create transaction record
      await prisma.transaction.create({
        data: {
          orderId: order.id,
          provider: providerName,
          providerTxId: `webhook-${Date.now()}`,
          status: result.newStatus,
          amount: order.amount,
          rawResponse: typeof payload === 'string' ? JSON.parse(payload) : payload,
        },
      })
    }

    return result
  }

  /**
   * Check payment status (for polling-based providers)
   */
  async checkPaymentStatus(orderId: string): Promise<{
    orderId: string
    status: string
    paidAt?: Date
  }> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      throw new PaymentError('Pedido não encontrado', 'ORDER_NOT_FOUND')
    }

    return {
      orderId: order.id,
      status: order.status,
      paidAt: order.paidAt || undefined,
    }
  }

  /**
   * Simulate payment (development only)
   */
  async simulatePayment(
    providerName: PaymentProvider,
    orderId: string
  ): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new PaymentError(
        'Simulação não permitida em produção',
        'CONFIGURATION_ERROR'
      )
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!order) {
      throw new PaymentError('Pedido não encontrado', 'ORDER_NOT_FOUND')
    }

    // For PIX, use the provider's simulation
    if (providerName === 'ABACATEPAY' && order.providerPaymentId) {
      const provider = paymentProviderRegistry.get('ABACATEPAY') as any
      await provider.simulatePayment(order.providerPaymentId)
      return
    }

    // For other providers, directly update the order
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.PAID,
        paidAt: new Date(),
      },
    })
  }

  /**
   * Get available payment methods
   */
  getAvailableMethods() {
    return paymentProviderRegistry.getAvailableMethods()
  }

  /**
   * Get configured providers
   */
  getConfiguredProviders() {
    return paymentProviderRegistry.getConfigured().map(p => ({
      name: p.name,
      methods: p.supportedMethods,
    }))
  }

  private getPaymentMethodForProvider(provider: PaymentProvider): PrismaPaymentMethod {
    switch (provider) {
      case PAYMENT_PROVIDERS.STRIPE:
        return 'CREDIT_CARD'
      case PAYMENT_PROVIDERS.MERCADOPAGO:
        return 'CREDIT_CARD'
      case PAYMENT_PROVIDERS.ABACATEPAY:
        return 'PIX'
      default:
        return 'CREDIT_CARD'
    }
  }
}

/**
 * Singleton instance
 */
export const paymentService = new PaymentService()
