// ============================================
// PAYMENT TYPES
// ============================================

import { Order, Product } from '@prisma/client'

/**
 * Supported payment providers
 */
export type PaymentProvider = 'STRIPE' | 'MERCADOPAGO' | 'ABACATEPAY' | 'GOOGLE_PLAY'

/**
 * Supported payment methods
 */
export type PaymentMethod = 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO' | 'IN_APP_PURCHASE'

/**
 * Input for creating a new payment (with product)
 */
export interface CreatePaymentInput {
  productId: string
  customerEmail: string
  customerName?: string
  customerPhone?: string // Phone for PIX
  customerTaxId?: string // CPF/CNPJ for PIX
  installments?: number // For Mercado Pago
  metadata?: Record<string, unknown>
}

/**
 * Input for creating a quick payment (without product)
 */
export interface CreateQuickPaymentInput {
  amount: number // em centavos
  currency?: string
  description: string
  customerEmail: string
  customerName?: string
  customerPhone?: string
  customerTaxId?: string
  metadata?: Record<string, unknown>
}

/**
 * Result of payment creation
 */
export interface PaymentResult {
  success: boolean
  orderId: string
  provider: PaymentProvider
  method: PaymentMethod

  // Common fields
  amount?: number
  currency?: string

  // Stripe specific
  clientSecret?: string

  // Mercado Pago specific
  preferenceId?: string
  initPoint?: string
  sandboxInitPoint?: string

  // PIX specific
  pixId?: string
  brCode?: string
  brCodeBase64?: string
  status?: string
  expiresAt?: string
}

/**
 * Webhook payload types per provider
 */
export interface WebhookPayload {
  provider: PaymentProvider
  rawBody: string
  signature?: string
  headers: Record<string, string>
}

/**
 * Result of webhook processing
 */
export interface WebhookResult {
  success: boolean
  orderId?: string
  newStatus?: 'PAID' | 'FAILED' | 'REFUNDED'
  message?: string
  error?: string
}

/**
 * Order with product included (product may be null for quick payments)
 */
export interface OrderWithProduct extends Order {
  product: Product | null
}

/**
 * Google Play purchase validation result
 */
export interface GooglePlayValidationResult {
  valid: boolean
  orderId?: string
  productId: string
  purchaseToken: string
  packageName: string
  expiryTime?: string
  paymentState?: number
  acknowledgementState?: number
  rawResponse?: Record<string, unknown>
}

/**
 * Payment status check result
 */
export interface PaymentStatusResult {
  orderId: string
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED'
  paidAt?: Date
}

/**
 * Error types for standardized error handling
 */
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: PaymentErrorCode,
    public provider?: PaymentProvider,
    public details?: unknown
  ) {
    super(message)
    this.name = 'PaymentError'
  }
}

export type PaymentErrorCode =
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_INACTIVE'
  | 'INVALID_INPUT'
  | 'PROVIDER_ERROR'
  | 'WEBHOOK_INVALID_SIGNATURE'
  | 'WEBHOOK_PROCESSING_ERROR'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ALREADY_PAID'
  | 'CONFIGURATION_ERROR'
  | 'GOOGLE_PLAY_VALIDATION_ERROR'
  // Inter-specific error codes
  | 'INTER_CERT_NOT_FOUND'
  | 'INTER_KEY_NOT_FOUND'
  | 'INTER_NOT_INITIALIZED'
  | 'INTER_API_ERROR'
  | 'CONFIG_MISSING'
  | 'OAUTH_PARSE_ERROR'
  | 'OAUTH_FAILED'
  | 'OAUTH_CONNECTION_ERROR'
  | 'AUTH_ERROR'
  | 'PARSE_ERROR'
  | 'CONNECTION_ERROR'
