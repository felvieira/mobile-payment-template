import Stripe from 'stripe'
import type { PaymentAdapter, CheckoutInput, CheckoutResult, WebhookVerification, SubscriptionStatus } from './types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' })

export const stripeAdapter: PaymentAdapter = {
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: input.planId, quantity: 1 }],
      customer_email: input.customerEmail,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/paywall`,
      metadata: { userId: input.userId },
    })
    return { redirectUrl: session.url!, providerSubId: session.id }
  },

  async verifyWebhook(req: Request): Promise<WebhookVerification> {
    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!
    try {
      const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
      return { valid: true, event }
    } catch {
      return { valid: false, event: null }
    }
  },

  async getStatus(providerSubId: string): Promise<SubscriptionStatus> {
    const sub = await stripe.subscriptions.retrieve(providerSubId)
    return {
      status: sub.status as SubscriptionStatus['status'],
      currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
    }
  },
}
