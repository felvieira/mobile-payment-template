# App Config — Forking the Template

## The single file to edit: `app.config.ts`

When forking this template for a new app, **only edit `app.config.ts`**. Every other file reads from it.

```ts
// app.config.ts
export const APP_CONFIG = {
  name: 'Payment Hub Demo',          // Android launcher name, UI headings
  packageName: 'com.payment_hub.demo', // Android package + Tauri identifier — MUST be globally unique
  deepLinkScheme: 'payment-hub',     // OAuth redirect + Stripe success_url deep link
  productionUrl: 'https://payment-hub.example.com', // Stripe webhook target, IAP validation URL
  iap: {
    monthlyProductId: 'premium_monthly',  // Must match Play Console product ID exactly
    annualProductId: 'premium_annual',
  },
  pricing: {
    monthly: 9.90,   // Display only — real price comes from Stripe/Play
    annual: 79.90,
  },
  adminEmails: ['admin@example.com'],
} as const

export type AppConfig = typeof APP_CONFIG
```

## How it is used throughout the codebase

| Location | Uses |
|----------|------|
| `src/app/(mobile)/paywall/page.tsx` | `APP_CONFIG.name`, `APP_CONFIG.pricing`, `APP_CONFIG.iap.*ProductId` |
| `src/lib/payments/abacate.ts` | `APP_CONFIG.pricing.annual`, `APP_CONFIG.name` for PIX description |
| `src/lib/payments/iap.ts` | `APP_CONFIG.productionUrl`, `APP_CONFIG.packageName` |
| `src-tauri/tauri.conf.json` | `productName`, `identifier`, deep-link scheme — edit this file too after editing `app.config.ts` |
| `scripts/configure-android-project.js` | Reads `app.config.ts` via regex, rewrites Android Gradle files |

## Steps to fork for a new app

### 1. Edit `app.config.ts`
Change `name`, `packageName`, `deepLinkScheme`, `productionUrl`. Update `iap.*` if you have Play Console products.

### 2. Edit `src-tauri/tauri.conf.json`
These must match `app.config.ts`:
```json
{
  "productName": "Your App Name",
  "identifier": "com.yourcompany.yourapp",
  "plugins": {
    "deepLink": {
      "mobile": { "scheme": "your-app" }
    }
  }
}
```

### 3. Rename Android project files
```bash
node scripts/configure-android-project.js
```
This rewrites `src-tauri/gen/android/app/build.gradle.kts` and Android manifest namespaces.

### 4. Update `.env.local`
Reusable keys (Stripe test, MercadoPago test, Abacate dev) are already there. Fill per-app keys:
- `GOOGLE_PLAY_PACKAGE_NAME` = your `packageName`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (create in Google Cloud Console for your domain)
- `NEXTAUTH_URL` = your production URL
- `RTDN_WEBHOOK_SECRET`, `FCM_SERVICE_ACCOUNT_JSON`, `NOTIFICATIONS_ADMIN_TOKEN`

### 5. Per-app credentials to create

| What | Console |
|------|---------|
| Google OAuth client | Google Cloud Console → APIs → Credentials → OAuth 2.0 Web → add your domain |
| Google Play app + products | Play Console → Create app → Monetize → Subscriptions |
| Google Play service account | Play Console → Setup → API access → Service accounts |
| Stripe products + webhook | Stripe Dashboard → Products → create; Webhooks → new endpoint |
| Firebase FCM project | Firebase Console → new project → Service accounts → Generate private key |
| Android keystore | `bash android-signing/generate-keystore.sh your-app` |
