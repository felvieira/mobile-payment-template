// ============================================
// PRODUCT TYPES
// ============================================

import { Product } from '@prisma/client'

/**
 * Product creation input
 */
export interface CreateProductInput {
  name: string
  description?: string
  price: number // in cents
  currency?: string
  imageUrl?: string
  active?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Product update input
 */
export interface UpdateProductInput {
  name?: string
  description?: string
  price?: number
  currency?: string
  imageUrl?: string
  active?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Product list filters
 */
export interface ProductFilters {
  active?: boolean
  minPrice?: number
  maxPrice?: number
}

/**
 * Product for frontend display
 */
export interface ProductDisplay {
  id: string
  name: string
  description: string | null
  price: number
  formattedPrice: string
  currency: string
  imageUrl: string | null
  active: boolean
}

/**
 * Re-export Prisma Product type
 */
export type { Product }
