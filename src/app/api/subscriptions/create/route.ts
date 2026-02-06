import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'

const createSubscriptionSchema = z.object({
  priceId: z.string(),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { priceId, customerEmail, customerName } = createSubscriptionSchema.parse(body)

    // Create or get customer
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    })

    let customerId: string
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName,
      })
      customerId = customer.id
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    })

    // Get payment intent
    const invoice = subscription.latest_invoice as any
    const paymentIntent = invoice?.payment_intent

    if (!paymentIntent?.client_secret) {
      throw new Error('Failed to create payment intent')
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent.client_secret,
      customerId,
    })
  } catch (error: any) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
