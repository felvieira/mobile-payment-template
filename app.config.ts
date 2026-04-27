export const APP_CONFIG = {
  /** Display name shown in UI and Android launcher. */
  name: 'Payment Hub Demo',
  /** Reverse-DNS Android package + Tauri identifier. Must be globally unique. */
  packageName: 'com.payment_hub.demo',
  /** Deep link scheme. Used for Stripe success_url and OAuth redirect. */
  deepLinkScheme: 'payment-hub',
  /** Public production URL — must match Stripe webhook target and Google OAuth allowed origin. */
  productionUrl: 'https://payment-hub.example.com',
  iap: {
    /** Google Play product IDs. Must match exactly what is configured in Play Console. */
    monthlyProductId: 'premium_monthly',
    annualProductId: 'premium_annual',
  },
  pricing: {
    /** Display-only prices (in BRL). Real prices come from Stripe/Play, this is just for the paywall UI. */
    monthly: 9.90,
    annual: 79.90,
  },
  /** Emails with admin panel access. */
  adminEmails: ['admin@example.com'],
} as const

export type AppConfig = typeof APP_CONFIG
