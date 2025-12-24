// ============================================
// PAYMENT PROVIDER - BASE INTERFACE
// ============================================

import { Order, Product } from '@prisma/client'
import {
  PaymentProvider as ProviderType,
  PaymentMethod,
  PaymentResult,
  WebhookResult,
} from '@/types'

/**
 * Base interface that all payment providers must implement.
 * This makes it easy to add new payment providers by implementing this interface.
 *
 * @example Adding a new provider:
 * ```typescript
 * export class PayPalProvider implements IPaymentProvider {
 *   readonly name = 'PAYPAL'
 *   readonly supportedMethods = ['CREDIT_CARD', 'DEBIT_CARD']
 *
 *   async createPayment(order, product, customerInfo) {
 *     // PayPal-specific implementation
 *   }
 *
 *   async handleWebhook(payload, signature) {
 *     // PayPal webhook handling
 *   }
 *
 *   validateWebhookSignature(signature, payload) {
 *     // PayPal signature validation
 *   }
 * }
 *
 * // Then register it:
 * paymentProviderRegistry.register(new PayPalProvider())
 * ```
 */
export interface IPaymentProvider {
  /**
   * Provider identifier (matches PaymentProvider type)
   */
  readonly name: ProviderType

  /**
   * Payment methods supported by this provider
   */
  readonly supportedMethods: PaymentMethod[]

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean

  /**
   * Create a new payment with this provider
   */
  createPayment(
    order: Order,
    product: Product,
    customerInfo: CustomerInfo
  ): Promise<PaymentResult>

  /**
   * Handle incoming webhook from the provider
   */
  handleWebhook(
    payload: string | object,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<WebhookResult>

  /**
   * Validate webhook signature (security)
   */
  validateWebhookSignature(
    signature: string,
    payload: string
  ): boolean

  /**
   * Check payment status (for polling-based providers like PIX)
   */
  checkPaymentStatus?(orderId: string): Promise<{
    status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'
    paidAt?: Date
  }>

  /**
   * Refund a payment (optional)
   */
  refundPayment?(orderId: string, amount?: number): Promise<{
    success: boolean
    refundId?: string
  }>
}

/**
 * Customer information for payment creation
 */
export interface CustomerInfo {
  email: string
  name?: string
  taxId?: string // CPF/CNPJ
  phone?: string
}

/**
 * Configuration for building webhook URLs
 */
export interface WebhookConfig {
  baseUrl: string
  secret?: string
}
