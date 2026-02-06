import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { subscriptionId } = cancelSubscriptionSchema.parse(body)

    // Cancel subscription
    const subscription = await stripe.subscriptions.cancel(subscriptionId)

    return NextResponse.json({
      success: true,
      subscription,
    })
  } catch (error: any) {
    console.error('Error canceling subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
