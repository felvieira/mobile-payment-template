# Tauri Android — Shell, Build, and CORS

## How the app works at runtime

```
Android device
└── Tauri shell (Rust/Kotlin)
    └── WebView → loads static HTML from local bundle (file://)
        └── Next.js pages (built with output: 'export')
            └── fetch() calls → go to PRODUCTION server (not localhost)
```

The APK contains a **static export** of the Next.js app. The WebView is served from the device filesystem — there is no local web server in the APK. API calls must go to the production server at `APP_CONFIG.productionUrl`.

## Build modes

### Web build (SSR — development and production server)
```bash
npm run dev        # localhost:3000 with SSR
npm run build      # SSR build for Coolify/server
```

### Tauri build (static export — goes into the APK)
```bash
npm run build:tauri   # sets NEXT_PUBLIC_TARGET=tauri → output: 'export' → out/
npm run tauri:android:build   # builds the APK with the static export
```

`next.config.ts` gates on `NEXT_PUBLIC_TARGET`:
```ts
const isTauri = process.env.NEXT_PUBLIC_TARGET === 'tauri'
const config: NextConfig = {
  output: isTauri ? 'export' : undefined,  // static export for APK
  images: { unoptimized: isTauri },
  trailingSlash: isTauri,
}
```

**Important:** Only `app/(mobile)/` routes need to work in the APK. Web-only routes (`admin/`, `checkout/`, `api/`) are NOT exported — they live on the server.

## CORS — why the IAP route uses `Access-Control-Allow-Origin: *`

When the Tauri Android WebView makes a `fetch()` to the production server, the browser sends an `Origin` header. That origin is **`tauri://localhost`** (or a variant like `https://tauri.localhost`), which is not a real HTTP origin you can whitelist in advance — it changes with Tauri versions and build configuration.

**Solution:** `src/app/api/iap/validate-google-play/route.ts` returns:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

**Do not change this.** If you restrict the CORS to a specific origin, IAP validation will silently fail with a CORS error in the Android WebView. The `OPTIONS` preflight handler must also remain.

The same applies to **any endpoint you add** that the Tauri Android app calls via `fetch()`. Pattern:

```ts
// In any route called from Tauri Android
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(req: NextRequest) {
  // ... your logic
  return NextResponse.json(result, { headers: corsHeaders })
}
```

## Tauri config (`src-tauri/tauri.conf.json`)

```json
{
  "identifier": "com.payment_hub.demo",     // Must match packageName in app.config.ts
  "build": {
    "frontendDist": "../out",               // Points to Next.js static export
    "beforeBuildCommand": "npm run build:tauri"
  },
  "plugins": {
    "deepLink": {
      "mobile": { "scheme": "payment-hub" } // Must match deepLinkScheme in app.config.ts
    }
  }
}
```

## Rust plugins (`src-tauri/Cargo.toml`)

```toml
tauri-plugin-iap = "0.6"           # Google Play Billing — used by src/lib/payments/iap.ts
tauri-plugin-notification = "2"    # Local notifications — used by src/lib/notifications/local.ts
tauri-plugin-deep-link = "2"       # Deep links for Stripe/OAuth redirects
tauri-plugin-shell = "2"           # Open external URLs
tauri-plugin-opener = "2"
tauri-plugin-log = "2"
```

## Platform detection

```ts
// src/lib/platform.ts
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getPlatform(): Promise<'web' | 'android' | 'ios' | 'desktop'> {
  if (!isTauri()) return 'web'
  const { type } = await import('@tauri-apps/plugin-os')
  const t = await type()
  if (t === 'android') return 'android'
  if (t === 'ios') return 'ios'
  return 'desktop'
}
```

Use `isTauri()` for synchronous guards. Use `getPlatform()` when you need Android vs desktop.

**Always use dynamic imports** for `@tauri-apps/*` to avoid SSR crashes:
```ts
// WRONG — crashes on server-side render
import { sendNotification } from '@tauri-apps/plugin-notification'

// CORRECT
const { sendNotification } = await import('@tauri-apps/plugin-notification')
```

## Deep links

The app registers the `payment-hub://` scheme. Stripe uses it for `success_url`:
```ts
success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`
```

On Android, if `NEXT_PUBLIC_SITE_URL` is your production URL, Stripe redirects the browser to that URL after payment, which triggers the deep link and opens the app.

## Local dev with Android emulator

```bash
# One-time setup
npm run tauri:android:init
node scripts/configure-android-project.js

# Run
npm run tauri:android:dev   # starts Next.js + Tauri Android dev server
```

Prerequisites: `ANDROID_HOME`, `NDK_HOME`, `JAVA_HOME` must be set.
NDK version: r25+ (same as memrapp production).

## Android release build (CI)

The APK is built **inside Docker** (see `Dockerfile.android`). This ensures a reproducible Rust + Android SDK environment without installing everything on the CI runner.

```
GitHub Actions runner
└── docker build -f Dockerfile.android
    └── Container:
        ├── npm run build:tauri      → out/
        ├── tauri android build      → APK + AAB
        └── apksigner (keystore)     → signed APK/AAB
docker cp → extract artifacts → upload to Play Console
```

Required GitHub Secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `PLAY_STORE_SERVICE_ACCOUNT_JSON`.

Generate keystore: `bash android-signing/generate-keystore.sh your-app`
