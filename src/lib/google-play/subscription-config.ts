export const GOOGLE_PLAY_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || 'app_premium_monthly'

export const GOOGLE_PLAY_ANNUAL_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_ANNUAL_PRODUCT_ID || 'app_premium_annual'

export const VALID_GOOGLE_PLAY_PRODUCT_IDS = [
  GOOGLE_PLAY_PRODUCT_ID,
  GOOGLE_PLAY_ANNUAL_PRODUCT_ID,
]

export type SubscriptionPlan = 'monthly' | 'annual'

export function getGooglePlayProductId(plan: SubscriptionPlan): string {
  if (plan === 'annual') return GOOGLE_PLAY_ANNUAL_PRODUCT_ID
  return GOOGLE_PLAY_PRODUCT_ID
}

export const GOOGLE_PLAY_PACKAGE_NAME =
  process.env.GOOGLE_PLAY_PACKAGE_NAME ||
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PACKAGE_NAME ||
  'com.your_app.demo'
