import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getPayment } from '@/lib/mercadopago'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, action, data } = body

    console.log('Mercado Pago webhook:', { type, action, data })

    // Processa apenas notificações de pagamento
    if (type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    const paymentId = data?.id
    if (!paymentId) {
      return NextResponse.json({ error: 'Payment ID ausente' }, { status: 400 })
    }

    // Busca detalhes do pagamento
    const payment = await getPayment(paymentId)
    const orderId = payment.external_reference

    if (!orderId) {
      console.log('External reference ausente')
      return NextResponse.json({ received: true })
    }

    // Verifica idempotência
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
    })

    if (!existingOrder) {
      console.log('Pedido não encontrado:', orderId)
      return NextResponse.json({ received: true })
    }

    if (existingOrder.status === 'PAID') {
      console.log('Pedido já pago, ignorando:', orderId)
      return NextResponse.json({ received: true })
    }

    // Atualiza baseado no status do pagamento
    if (payment.status === 'approved') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          providerPaymentId: paymentId.toString(),
          metadata: {
            ...((existingOrder.metadata as object) || {}),
            mpPaymentId: paymentId,
            mpPaymentMethod: payment.payment_method_id,
            mpPaymentType: payment.payment_type_id,
            mpInstallments: payment.installments,
          },
        },
      })

      await prisma.transaction.create({
        data: {
          orderId,
          provider: 'MERCADOPAGO',
          providerTxId: paymentId.toString(),
          status: 'approved',
          amount: Math.round(payment.transaction_amount * 100),
          rawResponse: payment,
        },
      })

      // Upsert Subscription for subscription-based payments
      const userId = payment.metadata?.userId ?? payment.external_reference
      const preapprovalId = payment.preapproval_id ?? paymentId.toString()
      if (userId) {
        await prisma.subscription.upsert({
          where: {
            provider_providerSubId: { provider: 'MERCADOPAGO', providerSubId: String(preapprovalId) },
          },
          create: {
            userId: String(userId),
            customerEmail: payment.payer?.email ?? existingOrder.customerEmail,
            provider: 'MERCADOPAGO',
            providerSubId: String(preapprovalId),
            status: 'active',
            planId: payment.description ?? orderId,
            rawPayload: payment,
          },
          update: {
            status: 'active',
            rawPayload: payment,
          },
        })
        console.log('[MercadoPago] Subscription upserted for userId:', userId)
      }

      console.log('Pagamento Mercado Pago aprovado:', orderId)
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'FAILED' },
      })

      await prisma.transaction.create({
        data: {
          orderId,
          provider: 'MERCADOPAGO',
          providerTxId: paymentId.toString(),
          status: payment.status,
          amount: Math.round(payment.transaction_amount * 100),
          rawResponse: payment,
        },
      })

      console.log('Pagamento Mercado Pago rejeitado:', orderId)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Erro no webhook Mercado Pago:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
