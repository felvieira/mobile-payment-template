// ============================================
// PRODUCT SERVICE
// ============================================

import { prisma } from '@/lib/db'
import { CreateProductInput, UpdateProductInput, ProductFilters, PaymentError } from '@/types'
import { DEFAULT_CURRENCY } from '@/constants'
import { isValidAmount, sanitizeString } from '@/utils'

/**
 * Product Service - Business logic for product management
 */
export class ProductService {
  /**
   * Get product by ID
   */
  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
    })

    if (!product) {
      throw new PaymentError('Produto não encontrado', 'PRODUCT_NOT_FOUND')
    }

    return product
  }

  /**
   * Get active product by ID (for checkout)
   */
  async getActiveById(id: string) {
    const product = await this.getById(id)

    if (!product.active) {
      throw new PaymentError('Produto inativo', 'PRODUCT_INACTIVE')
    }

    return product
  }

  /**
   * List products with filters
   */
  async list(filters?: ProductFilters) {
    const where: any = {}

    if (filters?.active !== undefined) {
      where.active = filters.active
    }

    if (filters?.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice }
    }

    if (filters?.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice }
    }

    return prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Create a new product
   */
  async create(input: CreateProductInput) {
    // Validate
    if (!input.name || input.name.trim().length === 0) {
      throw new PaymentError('Nome do produto é obrigatório', 'INVALID_INPUT')
    }

    if (!isValidAmount(input.price)) {
      throw new PaymentError('Preço inválido', 'INVALID_INPUT')
    }

    return prisma.product.create({
      data: {
        name: sanitizeString(input.name),
        description: input.description ? sanitizeString(input.description) : null,
        price: input.price,
        currency: input.currency || DEFAULT_CURRENCY,
        imageUrl: input.imageUrl || null,
        active: input.active ?? true,
        metadata: input.metadata as any,
      },
    })
  }

  /**
   * Update a product
   */
  async update(id: string, input: UpdateProductInput) {
    const product = await this.getById(id)

    const data: any = {}

    if (input.name !== undefined) {
      data.name = sanitizeString(input.name)
    }

    if (input.description !== undefined) {
      data.description = input.description ? sanitizeString(input.description) : null
    }

    if (input.price !== undefined) {
      if (!isValidAmount(input.price)) {
        throw new PaymentError('Preço inválido', 'INVALID_INPUT')
      }
      data.price = input.price
    }

    if (input.currency !== undefined) {
      data.currency = input.currency
    }

    if (input.imageUrl !== undefined) {
      data.imageUrl = input.imageUrl || null
    }

    if (input.active !== undefined) {
      data.active = input.active
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata
    }

    return prisma.product.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete a product
   */
  async delete(id: string) {
    // Check if product has orders
    const ordersCount = await prisma.order.count({
      where: { productId: id },
    })

    if (ordersCount > 0) {
      // Soft delete - just deactivate
      return prisma.product.update({
        where: { id },
        data: { active: false },
      })
    }

    // Hard delete if no orders
    return prisma.product.delete({
      where: { id },
    })
  }

  /**
   * Toggle product active status
   */
  async toggleActive(id: string) {
    const product = await this.getById(id)

    return prisma.product.update({
      where: { id },
      data: { active: !product.active },
    })
  }
}

/**
 * Singleton instance
 */
export const productService = new ProductService()
