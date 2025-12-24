// ============================================
// ORDER SERVICE
// ============================================

import { prisma } from '@/lib/db'
import { OrderFilters, UpdateOrderInput, PaymentError } from '@/types'
import { ORDER_STATUS } from '@/constants'

/**
 * Order Service - Business logic for order management
 */
export class OrderService {
  /**
   * Get order by ID with all relations
   */
  async getById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        product: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!order) {
      throw new PaymentError('Pedido não encontrado', 'ORDER_NOT_FOUND')
    }

    return order
  }

  /**
   * Get order by provider payment ID
   */
  async getByProviderPaymentId(providerPaymentId: string) {
    return prisma.order.findFirst({
      where: { providerPaymentId },
      include: { product: true },
    })
  }

  /**
   * List orders with filters
   */
  async list(filters?: OrderFilters) {
    const where: any = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.email) {
      where.customerEmail = {
        contains: filters.email,
        mode: 'insensitive',
      }
    }

    if (filters?.provider) {
      where.paymentProvider = filters.provider
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate
      }
    }

    return prisma.order.findMany({
      where,
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
      skip: filters?.offset || 0,
    })
  }

  /**
   * Update order
   */
  async update(id: string, data: UpdateOrderInput) {
    const order = await prisma.order.findUnique({
      where: { id },
    })

    if (!order) {
      throw new PaymentError('Pedido não encontrado', 'ORDER_NOT_FOUND')
    }

    // Prevent updating already paid orders
    if (order.status === ORDER_STATUS.PAID && data.status !== ORDER_STATUS.REFUNDED) {
      throw new PaymentError(
        'Pedido já está pago',
        'ORDER_ALREADY_PAID'
      )
    }

    return prisma.order.update({
      where: { id },
      data: {
        status: data.status,
        paidAt: data.paidAt,
        providerPaymentId: data.providerPaymentId,
        metadata: data.metadata as any,
      },
    })
  }

  /**
   * Mark order as paid
   */
  async markAsPaid(id: string, providerTxId?: string) {
    const order = await this.getById(id)

    if (order.status === ORDER_STATUS.PAID) {
      return order // Already paid
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: ORDER_STATUS.PAID,
        paidAt: new Date(),
      },
      include: { product: true },
    })

    // Log transaction
    await prisma.transaction.create({
      data: {
        orderId: id,
        provider: order.paymentProvider,
        providerTxId: providerTxId || `paid-${Date.now()}`,
        status: ORDER_STATUS.PAID,
        amount: order.amount,
        rawResponse: { markedAsPaid: true },
      },
    })

    return updated
  }

  /**
   * Mark order as failed
   */
  async markAsFailed(id: string, reason?: string) {
    const order = await this.getById(id)

    if (order.status === ORDER_STATUS.PAID) {
      throw new PaymentError(
        'Não é possível marcar como falho um pedido pago',
        'ORDER_ALREADY_PAID'
      )
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { status: ORDER_STATUS.FAILED },
      include: { product: true },
    })

    // Log transaction
    await prisma.transaction.create({
      data: {
        orderId: id,
        provider: order.paymentProvider,
        providerTxId: `failed-${Date.now()}`,
        status: ORDER_STATUS.FAILED,
        amount: order.amount,
        rawResponse: { reason },
      },
    })

    return updated
  }

  /**
   * Delete order and related transactions
   */
  async delete(id: string) {
    // Delete transactions first
    await prisma.transaction.deleteMany({
      where: { orderId: id },
    })

    // Delete order
    await prisma.order.delete({
      where: { id },
    })
  }

  /**
   * Get order statistics
   */
  async getStats(filters?: { startDate?: Date; endDate?: Date }) {
    const where: any = {}

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {}
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate
      }
    }

    const [total, paid, pending, failed, revenue] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.count({ where: { ...where, status: ORDER_STATUS.PAID } }),
      prisma.order.count({ where: { ...where, status: ORDER_STATUS.PENDING } }),
      prisma.order.count({ where: { ...where, status: ORDER_STATUS.FAILED } }),
      prisma.order.aggregate({
        where: { ...where, status: ORDER_STATUS.PAID },
        _sum: { amount: true },
      }),
    ])

    return {
      total,
      paid,
      pending,
      failed,
      revenue: revenue._sum.amount || 0,
    }
  }
}

/**
 * Singleton instance
 */
export const orderService = new OrderService()
