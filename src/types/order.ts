// ============================================
// ORDER TYPES
// ============================================

import { Order, Transaction, Product } from '@prisma/client'

/**
 * Order status enum
 */
export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'EXPIRED'

/**
 * Order with all relations
 */
export interface OrderWithRelations extends Order {
  product: Product
  transactions: Transaction[]
}

/**
 * Order list filters
 */
export interface OrderFilters {
  status?: OrderStatus
  email?: string
  provider?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

/**
 * Order creation input (internal use)
 */
export interface CreateOrderInput {
  productId: string
  customerEmail: string
  customerName?: string
  amount: number
  currency: string
  paymentMethod: string
  paymentProvider: string
  providerPaymentId?: string
  expiresAt?: Date
  metadata?: Record<string, unknown>
}

/**
 * Order update input
 */
export interface UpdateOrderInput {
  status?: OrderStatus
  paidAt?: Date
  providerPaymentId?: string
  metadata?: Record<string, unknown>
}
