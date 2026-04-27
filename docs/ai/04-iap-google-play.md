# Google Play IAP — Full Flow

## Overview

Google Play IAP uses `tauri-plugin-iap` (Rust) to open the native Play Billing overlay. After the user completes the purchase, the app sends the `purchaseToken` to the server for validation via the Android Publisher API.

## Complete flow

```
User taps "Assinar via Google Play"
↓
purchaseSubscription(productId)          ← src/lib/payments/iap.ts
↓
Tauri invoke: plugin:iap|purchase        ← tauri-plugin-iap 0.6 (Rust)
↓
Native Google Play Billing overlay       ← Android OS
↓
User completes payment
↓
{ purchaseToken }                        ← returned to JS
↓
validateOnServer(purchaseToken, ...)     ← src/lib/payments/iap.ts
↓
POST /api/iap/validate-google-play       ← src/app/api/iap/validate-google-play/route.ts
↓
validateGooglePlaySubscription(...)      ← src/lib/google-play-validator.ts
↓
Google Play Developer API                ← verifies purchaseToken server-side
↓
Write IAPReceipt + Subscription          ← Prisma
↓
{ status: 'active' }                     ← returned to client
↓
notify({ title: 'Compra concluída' })   ← local Tauri notification
```

## Client code (`src/lib/payments/iap.ts`)

```ts
// Step 1: Trigger native billing overlay
export async function purchaseSubscription(productId: string): Promise<{ purchaseToken: string }> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('plugin:iap|purchase', { productId })
}

// Step 2: Validate with server
export async function validateOnServer(
  purchaseToken: string,
  productId: string,
  userId: string,
  apiUrl: string,      // APP_CONFIG.productionUrl
  packageName: string, // APP_CONFIG.packageName
): Promise<{ status: 'active' | 'expired'; expiresAt: string }> {
  const res = await fetch(`${apiUrl}/api/iap/validate-google-play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseToken, productId, packageName, userId }),
  })
  if (!res.ok) throw new Error(`IAP validation failed: ${res.status}`)
  return res.json()
}
```

Usage in paywall:
```ts
const { purchaseToken } = await purchaseSubscription(APP_CONFIG.iap.monthlyProductId)
await validateOnServer(purchaseToken, APP_CONFIG.iap.monthlyProductId, userId, APP_CONFIG.productionUrl, APP_CONFIG.packageName)
```

## Server route (`src/app/api/iap/validate-google-play/route.ts`)

**CRITICAL:** This route has `Access-Control-Allow-Origin: *`. Do not change this — the Tauri Android WebView sends requests from `tauri://localhost` which is not a standard whitelistable origin.

The route:
1. Receives `{ purchaseToken, productId, packageName, userId }`
2. Calls `validateGooglePlaySubscription(packageName, productId, purchaseToken)` via `src/lib/google-play-validator.ts`
3. The validator uses `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` to authenticate with the Android Publisher API
4. On success, writes to `IAPReceipt` and upserts `Subscription` with `provider: 'GOOGLE_PLAY'`
5. Returns `{ status: 'active' | 'expired', expiresAt }`

## RTDN (Real-Time Developer Notifications)

Google Play sends real-time subscription events to a Pub/Sub topic when subscriptions renew, cancel, or expire. Route: `src/app/api/iap/google-play-rtdn/route.ts`.

Setup:
1. Google Cloud Console → Pub/Sub → Create topic
2. Create Push subscription → URL: `https://yourapp.com/api/iap/google-play-rtdn?secret=<RTDN_WEBHOOK_SECRET>`
3. Play Console → Monetize → Setup → Real-time developer notifications → link your Pub/Sub topic

The route verifies `?secret=` matches `RTDN_WEBHOOK_SECRET` env var, then updates `Subscription.status` accordingly.

## Env vars required

```
GOOGLE_PLAY_PACKAGE_NAME=com.your_app  # Must match app.config.ts packageName
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # Full JSON inline
RTDN_WEBHOOK_SECRET=<random strong string>
```

## Setting up Google Play service account

1. Google Play Console → Setup → API access → Link to Google Cloud project
2. Google Cloud Console → IAM → Service Accounts → Create service account
3. Grant roles: **Android Management User** or **Service Account** with Play permissions
4. Create JSON key → download → paste entire JSON as value of `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
5. Back in Play Console → Grant access to the service account with **Release manager** permissions

## Testing IAP in development

Google Play IAP requires:
- A signed APK uploaded to Play Console (Internal Testing track at minimum)
- Test account added to the Internal Testing track
- Device signed in with that test account

You cannot test IAP with `npm run tauri:android:dev` (unsigned debug build) unless you configure `tauri-plugin-iap` for debug mode. Production testing requires a signed build uploaded to Play Console.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `IAP validation failed: 403` | Service account lacks Android Publisher API permission | Re-check IAM roles in Google Cloud Console |
| CORS error in Android WebView | CORS restricted on validate-google-play route | Restore `Access-Control-Allow-Origin: *` |
| `plugin:iap|purchase invocation error` | Product not found in Play Console | Verify `productId` matches Play Console exactly |
| `purchaseToken invalid` | Token already consumed/acknowledged | Check `IAPReceipt.acknowledged` in DB |
