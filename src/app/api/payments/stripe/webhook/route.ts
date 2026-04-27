import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Assinatura ausente' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      )
    } catch (err) {
      console.error('Erro na verificação do webhook:', err)
      return NextResponse.json({ error: 'Assinatura inválida' }, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id

        if (userId && subscriptionId) {
          await prisma.subscription.upsert({
            where: {
              provider_providerSubId: { provider: 'STRIPE', providerSubId: subscriptionId },
            },
            create: {
              userId,
              customerEmail: session.customer_email ?? '',
              provider: 'STRIPE',
              providerSubId: subscriptionId,
              status: 'active',
              planId: session.metadata?.planId ?? '',
              rawPayload: session as unknown as never,
            },
            update: {
              status: 'active',
              rawPayload: session as unknown as never,
            },
          })
          console.log('[Stripe] Subscription upserted for userId:', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const existingSub = await prisma.subscription.findFirst({
          where: { provider: 'STRIPE', providerSubId: sub.id },
        })

        if (existingSub) {
          const currentPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
          await prisma.subscription.update({
            where: { id: existingSub.id },
            data: {
              status: sub.status,
              currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : undefined,
              rawPayload: sub as unknown as never,
            },
          })
          console.log('[Stripe] Subscription updated:', sub.id, 'status:', sub.status)
        }
        break
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          // Verifica idempotência
          const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
          })

          if (existingOrder?.status === 'PAID') {
            console.log('Pedido já pago, ignorando:', orderId)
            break
          }

          // Atualiza pedido
          await prisma.order.update({
            where: { id: orderId },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          })

          // Registra transação
          await prisma.transaction.create({
            data: {
              orderId,
              provider: 'STRIPE',
              providerTxId: paymentIntent.id,
              status: 'succeeded',
              amount: paymentIntent.amount,
              rawResponse: paymentIntent as unknown as never,
            },
          })

          console.log('Pagamento confirmado:', orderId)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        if (orderId) {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: 'FAILED' },
          })

          await prisma.transaction.create({
            data: {
              orderId,
              provider: 'STRIPE',
              providerTxId: paymentIntent.id,
              status: 'failed',
              amount: paymentIntent.amount,
              rawResponse: paymentIntent as unknown as never,
            },
          })

          console.log('Pagamento falhou:', orderId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Erro no webhook Stripe:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
