import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateWebhookSignature } from '@/lib/abacatepay'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const webhookSecret = searchParams.get('webhookSecret')

    // Valida secret da query
    const expectedSecret = process.env.ABACATEPAY_WEBHOOK_SECRET
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      console.error('Webhook secret inválido')
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const rawBody = await request.text()
    const body = JSON.parse(rawBody)

    // Valida assinatura HMAC (se presente)
    const signature = request.headers.get('X-Webhook-Signature')
    if (signature) {
      const isValid = validateWebhookSignature(rawBody, signature, expectedSecret)
      if (!isValid) {
        console.error('Assinatura HMAC inválida')
        return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
      }
    }

    console.log('Abacate Pay webhook:', body)

    // Processa apenas eventos de pagamento
    if (body.event !== 'billing.paid') {
      return NextResponse.json({ received: true })
    }

    const pixId = body.data?.id || body.data?.billing?.id
    if (!pixId) {
      console.log('PIX ID ausente')
      return NextResponse.json({ received: true })
    }

    // Busca pedido pelo providerPaymentId
    const order = await prisma.order.findFirst({
      where: { providerPaymentId: pixId },
    })

    if (!order) {
      // Tenta buscar pelo external_reference nos metadados
      console.log('Pedido não encontrado para PIX:', pixId)
      return NextResponse.json({ received: true })
    }

    // Verifica idempotência
    if (order.status === 'PAID') {
      console.log('Pedido já pago, ignorando:', order.id)
      return NextResponse.json({ received: true })
    }

    // Atualiza pedido
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    // Registra transação
    await prisma.transaction.create({
      data: {
        orderId: order.id,
        provider: 'ABACATEPAY',
        providerTxId: pixId,
        status: 'paid',
        amount: order.amount,
        rawResponse: body,
      },
    })

    console.log('Pagamento PIX confirmado:', order.id)

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Erro no webhook PIX:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
