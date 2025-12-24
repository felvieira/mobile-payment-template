// ============================================
// PAYMENT CONSTANTS
// ============================================

import { PaymentProvider, PaymentMethod, OrderStatus } from '@/types'

/**
 * Order status values
 */
export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
} as const

/**
 * Payment providers
 */
export const PAYMENT_PROVIDERS = {
  STRIPE: 'STRIPE',
  MERCADOPAGO: 'MERCADOPAGO',
  ABACATEPAY: 'ABACATEPAY',
} as const

/**
 * Payment methods
 */
export const PAYMENT_METHODS = {
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  PIX: 'PIX',
  BOLETO: 'BOLETO',
} as const

/**
 * Default currency
 */
export const DEFAULT_CURRENCY = 'BRL'

/**
 * PIX expiration time in minutes
 */
export const PIX_EXPIRATION_MINUTES = 30

/**
 * PIX polling interval in milliseconds
 */
export const PIX_POLL_INTERVAL_MS = 5000

/**
 * Provider display names
 */
export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  STRIPE: 'Stripe',
  MERCADOPAGO: 'Mercado Pago',
  ABACATEPAY: 'PIX (Abacate Pay)',
}

/**
 * Payment method display names
 */
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  PIX: 'PIX',
  BOLETO: 'Boleto',
}

/**
 * Order status display names
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  FAILED: 'Falhou',
  REFUNDED: 'Reembolsado',
  EXPIRED: 'Expirado',
}

/**
 * Supported currencies
 */
export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR'] as const
