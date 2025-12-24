import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY não configurada')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-11-17.clover',
  typescript: true,
})

export function formatAmountForStripe(amount: number): number {
  return Math.round(amount)
}

export function formatAmountFromStripe(amount: number): number {
  return amount / 100
}
