import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    mercadopago: {
      configured: !!(
        process.env.MERCADOPAGO_QA_ACCESS_TOKEN ||
        process.env.MERCADOPAGO_ACCESS_TOKEN
      ),
      env: process.env.MERCADOPAGO_ENV || 'qa',
    },
    stripe: {
      configured: !!process.env.STRIPE_SECRET_KEY,
      env: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live',
    },
    abacate: {
      configured: !!(
        process.env.ABACATE_PAY_DEV_API_KEY ||
        process.env.ABACATE_PAY_PROD_API_KEY
      ),
      env: process.env.ABACATE_PAY_ENV || 'dev',
    },
    googlePlay: {
      configured: !!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
      env: 'tauri-only',
    },
  })
}
