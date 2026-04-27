# Template — How to replicate this into a new mobile app

> This file is read by AI assistants to replicate the payment, IAP, notification, and CI setup into a new app. Keep it accurate and machine-readable.

## What this repo provides (out of the box, fully working)

- **Web app** (Next.js 16 SSR): admin panel, checkout pages
- **Android app** (Tauri 2): paywall with Google Play IAP, native notifications, deep links
- **Payments**:
  - Stripe (web — hosted checkout, subscription)
  - MercadoPago (web — pre-approval)
  - Abacate Pay PIX (web — transparent QR code)
  - Google Play IAP (Android only — `tauri-plugin-iap`)
- **Notifications**: Tauri local (`tauri-plugin-notification`) + FCM push (Firebase Admin)
- **Auth**: NextAuth v5 with Google OAuth
- **CI/CD**: GitHub Actions builds signed APK/AAB → Play Console + Coolify web deploy

## How to fork this template into a new app

### Step 1 — Edit `app.config.ts`

Change these 4 fields:
```ts
name: 'Your App Name',
packageName: 'com.yourcompany.yourapp',   // must be globally unique
deepLinkScheme: 'your-app',              // must be unique
productionUrl: 'https://yourapp.com',
```
Also update `iap.monthlyProductId`, `iap.annualProductId`, and `pricing` to match your Play Console products.

### Step 2 — Per-app credentials to create (open each link)

| What | Where to create | Env var to set |
|------|-----------------|----------------|
| Google OAuth client | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client ID → Web application → add your domain + `localhost:3000` to authorized origins; add `/api/auth/callback/google` to redirects | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Google Play app | [Play Console](https://play.google.com/console) → Create app → Note the package name (must match `app.config.ts`) | `GOOGLE_PLAY_PACKAGE_NAME` |
| Google Play products | Play Console → your app → Monetize → Products → Create subscription | `NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID` |
| Google Play service account | Play Console → Setup → API access → Link Google Cloud → Create service account → grant permissions → download JSON | `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` |
| RTDN Pub/Sub | Google Cloud Console → Pub/Sub → Create topic → Create push subscription → URL: `https://yourapp.com/api/iap/google-play-rtdn?secret=<RTDN_WEBHOOK_SECRET>` | `RTDN_WEBHOOK_SECRET` |
| Stripe webhook | [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → Add endpoint → `https://yourapp.com/api/stripe/webhook` → events: `checkout.session.completed`, `customer.subscription.updated` | `STRIPE_WEBHOOK_SECRET` |
| Stripe products | Stripe Dashboard → Products → Create → Copy price ID | `STRIPE_AI_PRICE_ID`, `STRIPE_AI_ANNUAL_PRICE_ID` |
| FCM project | [Firebase Console](https://console.firebase.google.com) → New project → Project settings → Service accounts → Generate private key | `FCM_SERVICE_ACCOUNT_JSON` |
| Android keystore | Run `bash android-signing/generate-keystore.sh your-app` → base64 encode → add to GitHub Secrets | `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` |

### Step 3 — Update `.env.local`

Copy `.env.example` to `.env.local` and fill in all values. Reusable keys (Stripe test, MercadoPago test, Abacate dev) are already in `.env.local` from the template — just fill the per-app ones.

### Step 4 — Rename Android project

```bash
node scripts/configure-android-project.js
```

This rewrites the Android Gradle files to use your `app.config.ts` package name.

### Step 5 — Add GitHub Secrets

Go to your repo → Settings → Secrets → Actions. Add all secrets from `.env.prod` plus:
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`
- `PLAY_STORE_SERVICE_ACCOUNT_JSON`
- `COOLIFY_DEPLOY_WEBHOOK` (Coolify → your service → Deploy webhook URL)

### Step 6 — Set up Coolify

Create a new service in Coolify pointing to your repo. Add all production env vars from `.env.prod`. Set the deploy webhook URL as GitHub Secret `COOLIFY_DEPLOY_WEBHOOK`.

## File map (where each feature lives)

| Feature | File(s) |
|---------|---------|
| Per-app config | `app.config.ts` |
| Stripe adapter | `src/lib/payments/stripe.ts` |
| MercadoPago adapter | `src/lib/payments/mercadopago.ts` |
| Abacate PIX adapter | `src/lib/payments/abacate.ts` |
| IAP client (Tauri) | `src/lib/payments/iap.ts` |
| Stripe webhook | `src/app/api/stripe/webhook/route.ts` |
| MercadoPago webhook | `src/app/api/mercadopago/webhook/route.ts` |
| PIX create/check/webhook | `src/app/api/pix/` |
| **IAP validate** (⚠️ DO NOT MODIFY — CORS `*` is intentional for Tauri) | `src/app/api/iap/validate-google-play/route.ts` |
| RTDN (Google Play realtime) | `src/app/api/iap/google-play-rtdn/route.ts` |
| FCM push (server) | `src/lib/notifications/push.ts` |
| Local notification (Tauri) | `src/lib/notifications/local.ts` |
| Push send endpoint | `src/app/api/notifications/send/route.ts` |
| Platform detection | `src/lib/platform.ts` |
| Paywall page | `src/app/(mobile)/paywall/page.tsx` |
| Status page | `src/app/(mobile)/status/page.tsx` |
| Auth (NextAuth) | `src/lib/auth/index.ts` |
| Prisma client | `src/lib/db.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Tauri Rust source | `src-tauri/src/` |
| Tauri config | `src-tauri/tauri.conf.json` |
| Android CI | `.github/workflows/android-release.yml` |
| Android PR build | `.github/workflows/deploy-android.yml` |
| Web deploy (Coolify) | `.github/workflows/deploy-web.yml` |
| Keystore generator | `android-signing/generate-keystore.sh` |
| Android renamer script | `scripts/configure-android-project.js` |

## Reusable vs. per-app keys

| Key | Reusable? | Notes |
|-----|-----------|-------|
| `STRIPE_SECRET_KEY` | yes (test) / no (live separate per account) | Same Stripe account works across apps |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | yes | Same as above |
| `STRIPE_WEBHOOK_SECRET` | no | Create one webhook endpoint per app |
| `STRIPE_AI_PRICE_ID` | no | Create product per app |
| `MERCADOPAGO_ACCESS_TOKEN` | yes | Same account across apps |
| `MERCADOPAGO_WEBHOOK_SECRET` | no | Per-app webhook |
| `ABACATE_PAY_DEV_API_KEY` | yes | Account-level dev key |
| `ABACATE_PAY_PROD_API_KEY` | yes | Account-level prod key |
| `ABACATE_PAY_WEBHOOK_SECRET` | no | Per-app |
| `GOOGLE_CLIENT_ID/SECRET` | no | Tied to OAuth app with specific package name |
| `GOOGLE_PLAY_PACKAGE_NAME` | no | Unique per app |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | yes | One service account can manage multiple apps |
| `RTDN_WEBHOOK_SECRET` | no | Per-app random string |
| `FCM_SERVICE_ACCOUNT_JSON` | no | Per-Firebase project |
| `NOTIFICATIONS_ADMIN_TOKEN` | no | Per-app random string |
| `NEXTAUTH_SECRET` | no | Per-app random string |

## Prerequisites for local development

- Node.js 20+
- Rust (`rustup default stable`)
- For Android: Android Studio, Android SDK (API 24+), NDK r25+, Java 17
  - Set `ANDROID_HOME`, `NDK_HOME`, `JAVA_HOME` env vars
- Docker (for CI parity and Android build)

## Important: Do NOT modify

`src/app/api/iap/validate-google-play/route.ts` uses CORS `*` headers intentionally. The Tauri Android app calls this from a `tauri://localhost` origin that varies per build. Removing or restricting CORS will break IAP validation on Android.
