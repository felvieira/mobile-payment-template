import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { z } from 'zod'

const portalSchema = z.object({
  customerId: z.string(),
  returnUrl: z.string().url(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { customerId, returnUrl } = portalSchema.parse(body)

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return NextResponse.json({
      url: session.url,
    })
  } catch (error: any) {
    console.error('Error creating portal session:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
