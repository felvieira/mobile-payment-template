# Mobile Template Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `D:\Repos\payment-hub` into a self-documenting standalone template repo with working Tauri Android shell, Stripe + MercadoPago + Abacate PIX + Google Play IAP, FCM notifications, and GitHub Actions CI — copyable to new mobile apps by editing `app.config.ts` plus per-app credentials.

**Architecture:** Sources Tauri shell, IAP, RTDN, PIX (Abacate), notifications, and Android CI from `D:\Repos\memrapp` (production-validated). Preserves existing Stripe + MercadoPago + Prisma in payment-hub. Adds `app.config.ts` as the single point of per-app customization and `TEMPLATE.md` as the AI-readable replication guide.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma 5, Tauri 2.9, Rust, Stripe SDK, MercadoPago SDK, Abacate Pay (HTTP), Firebase Admin SDK (FCM), Docker (Android build), GitHub Actions, Playwright.

**Working directory:** All work happens in `D:\Repos\payment-hub` on branch `feat/template-mobile` (already created and contains the design doc).

**Reference design:** [`docs/plans/2026-04-27-mobile-template-design.md`](2026-04-27-mobile-template-design.md)

---

## Pre-flight checks (do these once before Block 1)

**P1 — Confirm git state:**
```bash
cd D:/Repos/payment-hub
git status
git branch --show-current
```
Expected: branch `feat/template-mobile`, clean tree (design doc already committed).

**P2 — Install Rust toolchain (required for Tauri):**
```bash
rustc --version
```
If missing: `winget install Rustlang.Rustup` then `rustup default stable`.

**P3 — Verify Tauri CLI:**
```bash
npx --no-install tauri --version
```
If missing, will be installed in Block 3 via `npm install`.

**P4 — Confirm reference files exist in memrapp:**
```bash
ls D:/Repos/memrapp/src-tauri/Cargo.toml
ls D:/Repos/memrapp/Dockerfile.android
ls D:/Repos/memrapp/.dockerignore.android
ls D:/Repos/memrapp/scripts/configure-android-project.js
ls D:/Repos/memrapp/lib/pix-payment.ts
ls D:/Repos/memrapp/app/api/pix/create-payment/route.ts
ls D:/Repos/memrapp/app/api/iap/validate-google-play/route.ts
ls D:/Repos/memrapp/components/notifications-manager.tsx
ls D:/Repos/memrapp/.github/workflows/android-release.yml
```
All must exist. If any missing, stop and re-survey memrapp before proceeding.

---

## Block 1 — Foundation

### Task 1.1: Create `app.config.ts`

**Files:**
- Create: `app.config.ts`

**Step 1 — Write the file:**

```ts
// app.config.ts
// SINGLE SOURCE OF TRUTH for per-app values.
// When forking this template to a new app, this is the FIRST file you edit.
// Nothing else in the codebase should hardcode the package name, deep link, etc.

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
  /** Emails with admin panel access. Loaded into ADMIN_EMAILS env var at build time if empty. */
  adminEmails: ['admin@example.com'],
} as const

export type AppConfig = typeof APP_CONFIG
```

**Step 2 — Verify TypeScript accepts it:**
```bash
cd D:/Repos/payment-hub && npx tsc --noEmit app.config.ts
```
Expected: no output (success).

**Step 3 — Commit:**
```bash
git add app.config.ts
git commit -m "feat(template): add app.config.ts as single source of per-app config"
```

---

### Task 1.2: Create `TEMPLATE.md` skeleton

**Files:**
- Create: `TEMPLATE.md`

**Step 1 — Write skeleton (will be filled by Block 7):**

```markdown
# Template — How to replicate this into a new mobile app

> This file is read by AI assistants to replicate the payment, IAP, notification, and CI setup into a new app. Keep it accurate and machine-readable.

## What this repo provides (out of the box, fully working)

- Web app (Next.js 16): admin panel, web checkout
- Android app (Tauri): paywall with Google Play IAP, native notifications, deep links
- Payments: Stripe (web), MercadoPago (web), Abacate Pay PIX (web), Google Play IAP (Android)
- Notifications: Tauri local + FCM push
- CI: GitHub Actions builds signed Android APK/AAB and uploads to Play Console

## How to fork this template into a new app

> _Filled in Block 7. See `app.config.ts` for the values to change._

## File map (where each feature lives)

> _Filled in Block 7._

## Reusable vs. per-app keys

> _Filled in Block 7._
```

**Step 2 — Commit:**
```bash
git add TEMPLATE.md
git commit -m "docs(template): add TEMPLATE.md skeleton"
```

---

### Task 1.3: Read current Prisma schema and design additive migration

**Files:**
- Read: `prisma/schema.prisma`

**Step 1 — Confirm enum `PaymentProvider` already has `STRIPE | MERCADOPAGO | ABACATEPAY | GOOGLE_PLAY`** (verified during planning — it does).

**Step 2 — No code change yet, just confirm understanding.** The existing `Order` + `Transaction` models are kept. We add `Subscription` (recurring billing state) and `IAPReceipt` (Google Play purchase tokens) without altering existing models.

**Step 3 — No commit (read-only step).**

---

### Task 1.4: Add `Subscription` and `IAPReceipt` models to Prisma

**Files:**
- Modify: `prisma/schema.prisma` (append at end)

**Step 1 — Append models:**

```prisma
model Subscription {
  id               String          @id @default(cuid())
  userId           String
  customerEmail    String
  provider         PaymentProvider
  providerSubId    String          // Stripe sub id, GP purchaseToken, MP preapproval id, etc.
  status           String          // active | canceled | past_due | trialing | expired
  planId           String          // matches APP_CONFIG.iap.*ProductId or Stripe price id
  currentPeriodEnd DateTime?
  rawPayload       Json?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  @@unique([provider, providerSubId])
  @@index([userId])
  @@index([customerEmail])
  @@index([status])
}

model IAPReceipt {
  id             String   @id @default(cuid())
  userId         String
  customerEmail  String
  purchaseToken  String   @unique
  productId      String
  packageName    String
  acknowledged   Boolean  @default(false)
  rawPayload     Json
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([userId])
  @@index([customerEmail])
}
```

**Step 2 — Generate migration:**
```bash
cd D:/Repos/payment-hub && npx prisma migrate dev --name add_subscription_and_iap_receipt
```
Expected: prompts for DATABASE_URL if not set; creates migration file under `prisma/migrations/<timestamp>_add_subscription_and_iap_receipt/migration.sql`.

> **If DATABASE_URL is not set locally:** copy from `.env.docker` or use a local Postgres. Do NOT touch a remote production DB — abort and ask the user.

**Step 3 — Verify Prisma client regenerates:**
```bash
npx prisma generate
```
Expected: "Generated Prisma Client" output.

**Step 4 — Commit:**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Subscription and IAPReceipt models"
```

---

## Block 2 — Payments (adapters + webhooks + IAP routes)

### Task 2.1: Define adapter interface

**Files:**
- Create: `src/lib/payments/types.ts`

**Step 1 — Write file:**

```ts
// src/lib/payments/types.ts
export interface CheckoutInput {
  userId: string
  customerEmail: string
  planId: string
}

export interface CheckoutResult {
  /** Set for hosted checkout (Stripe, MercadoPago). Client redirects here. */
  redirectUrl?: string
  /** Set for PIX. Display the BR code text and the base64 PNG inline. */
  brCode?: string
  brCodeBase64?: string
  /** Set for IAP — opaque ref the client passes back after the native purchase. */
  paymentRef?: string
  /** Provider-side ID of the created checkout/charge — store for webhook reconciliation. */
  providerSubId: string
  expiresAt?: Date
}

export interface WebhookVerification {
  valid: boolean
  event: unknown
}

export interface SubscriptionStatus {
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'expired'
  currentPeriodEnd?: Date
}

export interface PaymentAdapter {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  verifyWebhook(req: Request): Promise<WebhookVerification>
  getStatus(providerSubId: string): Promise<SubscriptionStatus>
}
```

**Step 2 — Verify type-checks:**
```bash
npx tsc --noEmit src/lib/payments/types.ts
```

**Step 3 — Commit:**
```bash
git add src/lib/payments/types.ts
git commit -m "feat(payments): define unified PaymentAdapter interface"
```

---

### Task 2.2: Copy Abacate Pay adapter from memrapp

**Files:**
- Create: `src/lib/payments/abacate.ts`
- Reference (read only): `D:/Repos/memrapp/lib/pix-payment.ts`

**Step 1 — Copy source file:**
```bash
cp D:/Repos/memrapp/lib/pix-payment.ts D:/Repos/payment-hub/src/lib/payments/abacate.ts
```

**Step 2 — Read the copied file and remove memrapp-specific imports:**
- `import { PRICING } from '@/lib/subscription-config'` → replace with `import { APP_CONFIG } from '@/../app.config'` and use `APP_CONFIG.pricing.annual`.
- Any reference to memrapp UI strings — make generic.

**Step 3 — Wrap in `PaymentAdapter` shape:**
At the bottom of the file, add:

```ts
import type { PaymentAdapter, CheckoutInput, CheckoutResult } from './types'

export const abacateAdapter: PaymentAdapter = {
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await createAbacatePixPayment(input.userId, input.customerEmail)
    if (!res.success) throw new Error(res.error || 'Abacate PIX failed')
    return {
      brCode: res.data.brCode,
      brCodeBase64: res.data.brCodeBase64,
      providerSubId: res.data.id,
      expiresAt: new Date(res.data.expiresAt),
    }
  },
  async verifyWebhook(req) {
    // Implemented in Task 2.3 when webhook route is added.
    throw new Error('verifyWebhook implemented in route handler')
  },
  async getStatus(providerSubId) {
    const r = await checkAbacatePixStatus(providerSubId) // function copied from memrapp
    return { status: r.data.status === 'PAID' ? 'active' : 'expired' }
  },
}
```

**Step 4 — Verify type-checks:**
```bash
npx tsc --noEmit
```
Expected: no errors. If errors, fix imports and re-run.

**Step 5 — Commit:**
```bash
git add src/lib/payments/abacate.ts
git commit -m "feat(payments): add Abacate Pay PIX adapter from memrapp"
```

---

### Task 2.3: Copy PIX API routes from memrapp

**Files:**
- Create: `app/api/pix/create-payment/route.ts`
- Create: `app/api/pix/check-status/route.ts`
- Create: `app/api/pix/webhook/route.ts`

**Step 1 — Copy each route:**
```bash
mkdir -p app/api/pix/{create-payment,check-status,webhook}
cp D:/Repos/memrapp/app/api/pix/create-payment/route.ts app/api/pix/create-payment/route.ts
cp D:/Repos/memrapp/app/api/pix/check-status/route.ts   app/api/pix/check-status/route.ts
cp D:/Repos/memrapp/app/api/pix/webhook/route.ts        app/api/pix/webhook/route.ts
```

**Step 2 — Read each file and adapt:**
- Replace memrapp Supabase client calls with Prisma equivalent: `Subscription.upsert({ where: { provider_providerSubId: { provider: 'ABACATEPAY', providerSubId: pixId } }, create: {...}, update: { status: 'active', rawPayload } })`.
- Replace `import { createClient } from '@/lib/supabase/server'` with `import { prisma } from '@/lib/db'` (Prisma client — verify path; in payment-hub it might be `@/lib/prisma`).
- Keep webhook signature verification (Abacate sends `webhookSecret` header).

**Step 3 — Find or create the Prisma client export:**
```bash
grep -r "PrismaClient" src/lib/ --include="*.ts" | head -5
```
If no client wrapper exists, create `src/lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client'
export const prisma = (globalThis as any).prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') (globalThis as any).prisma = prisma
```

**Step 4 — Type-check:**
```bash
npx tsc --noEmit
```

**Step 5 — Commit:**
```bash
git add src/lib/db.ts app/api/pix/
git commit -m "feat(api): port Abacate PIX routes from memrapp, swap Supabase for Prisma"
```

---

### Task 2.4: Refactor existing Stripe to adapter shape

**Files:**
- Read: existing `src/lib/services/stripe.ts` or wherever Stripe is wired (find it)
- Create or modify: `src/lib/payments/stripe.ts`

**Step 1 — Locate existing Stripe code:**
```bash
grep -r "stripe" src/ --include="*.ts" -l | head -10
```

**Step 2 — Create `src/lib/payments/stripe.ts` exporting `stripeAdapter: PaymentAdapter`:**
- Move logic from existing service files
- `createCheckout` → `stripe.checkout.sessions.create({ mode: 'subscription', line_items: [{ price: planId }], ... })` returning `{ redirectUrl: session.url!, providerSubId: session.id }`
- `verifyWebhook` → `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`
- `getStatus` → `stripe.subscriptions.retrieve(providerSubId)` mapped to `{ status, currentPeriodEnd }`

**Step 3 — Update existing webhook route `app/api/stripe/webhook/route.ts` (or create) to use `stripeAdapter.verifyWebhook` and write to `Subscription` table.**

**Step 4 — Type-check + run existing Playwright Stripe test:**
```bash
npm run test:stripe
```
Expected: existing test still passes (or skips if no Stripe key set in env).

**Step 5 — Commit:**
```bash
git add src/lib/payments/stripe.ts app/api/stripe/
git commit -m "refactor(payments): wrap Stripe in PaymentAdapter, write Subscriptions to unified table"
```

---

### Task 2.5: Refactor existing MercadoPago to adapter shape

**Same pattern as 2.4** but for MercadoPago. Existing test: `npm run test:mercadopago`.

**Commit:**
```bash
git commit -m "refactor(payments): wrap MercadoPago in PaymentAdapter"
```

---

### Task 2.6: Copy Google Play IAP routes from memrapp (DO NOT MODIFY)

**Files:**
- Create: `app/api/iap/validate-google-play/route.ts`
- Create: `app/api/iap/google-play-rtdn/route.ts`

> **CRITICAL:** The `validate-google-play` route uses CORS `*` intentionally — the Tauri Android app calls it from a `tauri://localhost` origin that varies per build. The user's memory explicitly says do not touch this. **Copy as-is.**

**Step 1 — Copy:**
```bash
mkdir -p app/api/iap/{validate-google-play,google-play-rtdn}
cp D:/Repos/memrapp/app/api/iap/validate-google-play/route.ts app/api/iap/validate-google-play/route.ts
cp D:/Repos/memrapp/app/api/iap/google-play-rtdn/route.ts     app/api/iap/google-play-rtdn/route.ts
```

**Step 2 — Adapt only the database calls (Supabase → Prisma):**
- After validating with Android Publisher API, write to `IAPReceipt` and `Subscription` (provider `GOOGLE_PLAY`).
- Do NOT change the CORS headers, request shape, or auth logic.

**Step 3 — Verify CORS is preserved:**
```bash
grep -n "Access-Control-Allow-Origin" app/api/iap/validate-google-play/route.ts
```
Expected: `'*'` present.

**Step 4 — Commit:**
```bash
git add app/api/iap/
git commit -m "feat(iap): port Google Play IAP validation + RTDN routes from memrapp (CORS * preserved)"
```

---

### Task 2.7: Create IAP client adapter

**Files:**
- Create: `src/lib/payments/iap.ts`

**Step 1 — Write client wrapper around `tauri-plugin-iap`:**

```ts
// src/lib/payments/iap.ts
// Client-side wrapper for Google Play IAP via tauri-plugin-iap.
// Server validation lives at app/api/iap/validate-google-play/route.ts.

import { invoke } from '@tauri-apps/api/core'
import { APP_CONFIG } from '@/../app.config'

export async function purchaseSubscription(productId: string): Promise<{ purchaseToken: string }> {
  const result = await invoke<{ purchaseToken: string }>('plugin:iap|purchase', {
    productId,
  })
  return result
}

export async function validateOnServer(purchaseToken: string, productId: string, userId: string) {
  const res = await fetch(`${APP_CONFIG.productionUrl}/api/iap/validate-google-play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      purchaseToken,
      productId,
      packageName: APP_CONFIG.packageName,
      userId,
    }),
  })
  if (!res.ok) throw new Error(`IAP validation failed: ${res.status}`)
  return res.json() as Promise<{ status: 'active' | 'expired'; expiresAt: string }>
}
```

**Step 2 — Type-check:**
```bash
npx tsc --noEmit
```
Expected: may complain about missing `@tauri-apps/api` until Block 3 installs it. If so, leave the error and continue — Block 3 fixes it.

**Step 3 — Commit:**
```bash
git add src/lib/payments/iap.ts
git commit -m "feat(payments): add Tauri IAP client adapter"
```

---

## Block 3 — Tauri Android shell

### Task 3.1: Install Tauri dependencies

**Step 1 — Install:**
```bash
cd D:/Repos/payment-hub && npm install --save @tauri-apps/api@^2 @tauri-apps/plugin-deep-link@^2 @tauri-apps/plugin-notification@^2 @tauri-apps/plugin-os@^2
npm install --save-dev @tauri-apps/cli@^2
```

**Step 2 — Verify install:**
```bash
npx tauri --version
```
Expected: `tauri-cli 2.x.x`.

**Step 3 — Commit `package.json` + lockfile:**
```bash
git add package.json package-lock.json
git commit -m "feat(tauri): install Tauri 2 + deep-link/notification/os plugins"
```

---

### Task 3.2: Copy `src-tauri/` from memrapp

**Files:**
- Create: `src-tauri/` (entire directory copied)

**Step 1 — Copy (excluding build outputs and Cargo.lock):**
```bash
mkdir -p src-tauri
cp -r D:/Repos/memrapp/src-tauri/src        src-tauri/
cp -r D:/Repos/memrapp/src-tauri/capabilities src-tauri/
cp -r D:/Repos/memrapp/src-tauri/icons       src-tauri/
cp    D:/Repos/memrapp/src-tauri/build.rs    src-tauri/
cp    D:/Repos/memrapp/src-tauri/Cargo.toml  src-tauri/
cp    D:/Repos/memrapp/src-tauri/tauri.conf.json src-tauri/
```

> Skip `Cargo.lock` (regenerated), `target/` (build output), `gen/` (generated Android project — regenerated by `tauri android init`).

**Step 2 — Edit `src-tauri/Cargo.toml`:**
- Change `name = "app"` to `name = "payment-hub"`.
- Keep all dependencies as-is (`tauri-plugin-iap = "0.6"`, `tauri-plugin-notification = "2"`, `tauri-plugin-deep-link = "2"`, etc.).

**Step 3 — Edit `src-tauri/tauri.conf.json`:**
- `productName`: `"Payment Hub Demo"` (matches `APP_CONFIG.name`)
- `identifier`: `"com.payment_hub.demo"` (matches `APP_CONFIG.packageName`)
- `plugins.deepLink.mobile.scheme`: `"payment-hub"` (matches `APP_CONFIG.deepLinkScheme`)
- `version`: `"0.1.0"`
- `build.frontendDist`: `"../out"`
- `build.beforeBuildCommand`: `"npm run build:tauri"` (script added in 3.4)

**Step 4 — Commit:**
```bash
git add src-tauri/
git commit -m "feat(tauri): copy src-tauri/ from memrapp, parametrize for payment-hub"
```

---

### Task 3.3: Copy `scripts/configure-android-project.js` from memrapp

**Files:**
- Create: `scripts/configure-android-project.js`

**Step 1 — Copy and adapt:**
```bash
mkdir -p scripts
cp D:/Repos/memrapp/scripts/configure-android-project.js scripts/configure-android-project.js
```

**Step 2 — Read the file** and replace any hardcoded `com.memrapp.bible` / `Memra` references with reads from `app.config.ts`. Use `require('../app.config')` (transpile to CommonJS or use a `.cjs` extension if needed).

**Step 3 — Commit:**
```bash
git add scripts/configure-android-project.js
git commit -m "feat(android): port configure-android-project script with APP_CONFIG"
```

---

### Task 3.4: Configure Next.js for dual mode (web + Tauri export)

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json`

**Step 1 — Update `next.config.ts`:**

```ts
import type { NextConfig } from 'next'

const isTauri = process.env.NEXT_PUBLIC_TARGET === 'tauri'

const config: NextConfig = {
  output: isTauri ? 'export' : undefined,
  images: { unoptimized: isTauri },
  trailingSlash: isTauri,
}

export default config
```

**Step 2 — Add scripts to `package.json`:**

```json
{
  "scripts": {
    "build:tauri": "NEXT_PUBLIC_TARGET=tauri next build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:android:init": "tauri android init",
    "tauri:android:dev": "NEXT_PUBLIC_TARGET=tauri tauri android dev",
    "tauri:android:build": "NEXT_PUBLIC_TARGET=tauri tauri android build"
  }
}
```

> On Windows, use `cross-env` or set `NEXT_PUBLIC_TARGET=tauri` via `set` in PowerShell. Add `cross-env` to dev deps:
> `npm i -D cross-env`
> Then prefix scripts: `"build:tauri": "cross-env NEXT_PUBLIC_TARGET=tauri next build"`.

**Step 3 — Test web build still works:**
```bash
npm run build
```
Expected: builds successfully (SSR mode, no export).

**Step 4 — Test Tauri export build:**
```bash
npm run build:tauri
```
Expected: builds with `out/` directory created. **Will fail if any route uses dynamic SSR features (server actions, dynamic = 'force-dynamic').** If it fails, isolate offending route — only `(mobile)/` routes need to be exportable; web-only routes can stay SSR by `export const dynamic = 'force-dynamic'` and excluding them from export via `generateStaticParams` returning empty.

> **Decision point:** if the existing payment-hub `admin/` and `checkout/` routes can't be statically exported, configure them as web-only and the Tauri build skips them (only `(mobile)/` ships in the APK).

**Step 5 — Commit:**
```bash
git add next.config.ts package.json package-lock.json
git commit -m "feat(build): add NEXT_PUBLIC_TARGET=tauri dual-mode build"
```

---

### Task 3.5: Initialize Android project

**Step 1 — Run init:**
```bash
cd D:/Repos/payment-hub && npm run tauri:android:init
```
Expected: prompts for Android SDK / NDK paths if not set; creates `src-tauri/gen/android/`.

> **Prerequisites:** ANDROID_HOME, NDK_HOME, JAVA_HOME must be set. If not, the init will fail with a clear message — install Android Studio + NDK, set env vars, retry. **Document the required env vars in `TEMPLATE.md` (Block 7).**

**Step 2 — Run configure script:**
```bash
node scripts/configure-android-project.js
```
Expected: rewrites `src-tauri/gen/android/app/build.gradle.kts` namespaces to match `APP_CONFIG.packageName`.

**Step 3 — Add `src-tauri/gen/` to `.gitignore`:**
```bash
echo "src-tauri/gen/" >> .gitignore
echo "src-tauri/target/" >> .gitignore
echo "src-tauri/Cargo.lock" >> .gitignore   # already in default Tauri gitignore but verify
```

**Step 4 — Commit:**
```bash
git add scripts/configure-android-project.js .gitignore
git commit -m "feat(android): wire android init + configure script"
```

---

## Block 4 — Notifications

### Task 4.1: Local notifications wrapper

**Files:**
- Create: `src/lib/notifications/local.ts`

**Step 1 — Write file:**

```ts
// src/lib/notifications/local.ts
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification'

export async function ensurePermission(): Promise<boolean> {
  if (await isPermissionGranted()) return true
  const result = await requestPermission()
  return result === 'granted'
}

export async function notify(input: { title: string; body: string }): Promise<void> {
  const ok = await ensurePermission()
  if (!ok) throw new Error('Notification permission denied')
  await sendNotification(input)
}
```

**Step 2 — Commit:**
```bash
git add src/lib/notifications/local.ts
git commit -m "feat(notifications): add local Tauri notification wrapper"
```

---

### Task 4.2: FCM push server-side dispatcher

**Files:**
- Create: `src/lib/notifications/push.ts`
- Create: `app/api/notifications/send/route.ts`

**Step 1 — Install Firebase Admin SDK:**
```bash
npm install firebase-admin
```

**Step 2 — Write `src/lib/notifications/push.ts`:**

```ts
import admin from 'firebase-admin'

let app: admin.app.App | null = null

function getAdmin() {
  if (app) return app
  const json = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error('FCM_SERVICE_ACCOUNT_JSON not set')
  app = admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) })
  return app
}

export async function sendPush(input: {
  deviceToken: string
  title: string
  body: string
  data?: Record<string, string>
}): Promise<string> {
  const messaging = getAdmin().messaging()
  return messaging.send({
    token: input.deviceToken,
    notification: { title: input.title, body: input.body },
    data: input.data,
  })
}
```

**Step 3 — Write `app/api/notifications/send/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendPush } from '@/lib/notifications/push'

const Schema = z.object({
  deviceToken: z.string().min(1),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  data: z.record(z.string(), z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.NOTIFICATIONS_ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = Schema.parse(await req.json())
  const messageId = await sendPush(body)
  return NextResponse.json({ messageId })
}
```

**Step 4 — Type-check + commit:**
```bash
npx tsc --noEmit
git add src/lib/notifications/push.ts app/api/notifications/send/route.ts package.json package-lock.json
git commit -m "feat(notifications): add FCM push dispatcher + send endpoint"
```

---

## Block 5 — Mini-app paywall

### Task 5.1: Platform detection helper

**Files:**
- Create: `src/lib/platform.ts`

**Step 1 — Write file:**

```ts
import { type } from '@tauri-apps/plugin-os'

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function platform(): Promise<'web' | 'android' | 'ios' | 'desktop'> {
  if (!isTauri()) return 'web'
  const t = await type()
  if (t === 'android') return 'android'
  if (t === 'ios') return 'ios'
  return 'desktop'
}
```

**Step 2 — Commit:**
```bash
git add src/lib/platform.ts
git commit -m "feat(platform): add Tauri platform detection helper"
```

---

### Task 5.2: Paywall page

**Files:**
- Create: `app/(mobile)/paywall/page.tsx`

**Step 1 — Write page:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { APP_CONFIG } from '@/../app.config'
import { platform } from '@/lib/platform'
import { purchaseSubscription, validateOnServer } from '@/lib/payments/iap'
import { notify } from '@/lib/notifications/local'

export default function Paywall() {
  const [plat, setPlat] = useState<'web' | 'android' | 'ios' | 'desktop'>('web')
  useEffect(() => { platform().then(setPlat) }, [])

  // TODO: real userId from auth — placeholder until Task 5.4
  const userId = 'demo-user'

  async function buyIap() {
    const { purchaseToken } = await purchaseSubscription(APP_CONFIG.iap.monthlyProductId)
    await validateOnServer(purchaseToken, APP_CONFIG.iap.monthlyProductId, userId)
    await notify({ title: 'Purchase complete', body: 'Premium activated' })
  }

  async function buyStripe() {
    const r = await fetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ userId, planId: 'monthly' }) })
    const { redirectUrl } = await r.json()
    window.location.href = redirectUrl
  }

  async function buyMP() {
    const r = await fetch('/api/mercadopago/checkout', { method: 'POST', body: JSON.stringify({ userId, planId: 'monthly' }) })
    const { redirectUrl } = await r.json()
    window.location.href = redirectUrl
  }

  async function buyPix() {
    const r = await fetch('/api/pix/create-payment', { method: 'POST', body: JSON.stringify({ userId, planId: 'annual' }) })
    const { brCode, brCodeBase64 } = await r.json()
    // Render QR — handled by separate component, omitted here for brevity
    window.dispatchEvent(new CustomEvent('pix:show', { detail: { brCode, brCodeBase64 } }))
  }

  if (plat === 'android') {
    return (
      <div className="paywall">
        <h1>{APP_CONFIG.name} Premium</h1>
        <p>R$ {APP_CONFIG.pricing.monthly.toFixed(2)} / mês</p>
        <button onClick={buyIap}>Assinar via Google Play</button>
      </div>
    )
  }

  return (
    <div className="paywall">
      <h1>{APP_CONFIG.name} Premium</h1>
      <button onClick={buyStripe}>Cartão (Stripe)</button>
      <button onClick={buyMP}>MercadoPago</button>
      <button onClick={buyPix}>PIX (anual R$ {APP_CONFIG.pricing.annual.toFixed(2)})</button>
    </div>
  )
}
```

**Step 2 — Commit:**
```bash
git add 'app/(mobile)/paywall/page.tsx'
git commit -m "feat(mobile): add platform-aware paywall page"
```

---

### Task 5.3: Status page

**Files:**
- Create: `app/(mobile)/status/page.tsx`

**Step 1 — Write page that:**
- Fetches `/api/subscriptions/me` (next task) and shows current status
- Has a "Send test notification" button calling `notify({...})`

**Step 2 — Create supporting endpoint `app/api/subscriptions/me/route.ts`:**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') ?? 'demo-user'
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ subscription: sub })
}
```

**Step 3 — Commit:**
```bash
git add 'app/(mobile)/status/page.tsx' app/api/subscriptions/
git commit -m "feat(mobile): add subscription status page + endpoint"
```

---

### Task 5.4: Auth (Google OAuth)

> **Decision point flagged in design:** memrapp uses Supabase Auth. payment-hub doesn't. Two options:
>
> **A.** Add Supabase Auth client-side only (auth tokens), keep Prisma for everything else. Smallest diff, but adds Supabase dep.
>
> **B.** Use NextAuth.js with Google provider. Cleaner — payment-hub stays Supabase-free.
>
> **Recommendation: B.** Reason: template should be Supabase-optional. The user's memory says memrapp uses Postgres local + Supabase, but new apps may not want Supabase.
>
> **Confirm with user before executing this task.** If they say "use Supabase like memrapp," switch to A.

**Files (assuming option B):**
- Create: `src/lib/auth/index.ts`
- Modify: `app/api/auth/[...nextauth]/route.ts`

**Step 1 — Install:**
```bash
npm install next-auth@beta
```

**Step 2 — Configure with Google provider, write user to Prisma `User` model (add to schema if missing).**

**Step 3 — Commit.**

---

## Block 6 — CI / CD

### Task 6.1: Copy Android workflows from memrapp

**Files:**
- Create: `.github/workflows/android-release.yml`
- Create: `.github/workflows/deploy-android.yml`
- Create: `Dockerfile.android`
- Create: `.dockerignore.android`

**Step 1 — Copy:**
```bash
mkdir -p .github/workflows
cp D:/Repos/memrapp/.github/workflows/android-release.yml .github/workflows/
cp D:/Repos/memrapp/.github/workflows/deploy-android.yml  .github/workflows/
cp D:/Repos/memrapp/Dockerfile.android                    ./
cp D:/Repos/memrapp/.dockerignore.android                 ./
```

**Step 2 — Edit each file:**
- Replace `memrapp` / `Memra` / `com.memrapp.bible` references with placeholders that read from `APP_CONFIG` at build time. Workflow YAML can't import TS — use `node -e "console.log(require('./app.config').APP_CONFIG.packageName)"` in a setup step that exports env vars consumed by later steps.
- Replace `r0adkll/upload-google-play@v1`'s `packageName: com.memrapp.bible` with `${{ env.PACKAGE_NAME }}` set from the prior step.
- Replace `releaseFiles: android-release/memrapp-signed.aab` with `android-release/app-signed.aab` (generic name).
- Replace `NEXT_PUBLIC_SUPABASE_*` env vars with whatever the chosen auth in 5.4 needs (probably `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

**Step 3 — Document required GitHub Secrets in `TEMPLATE.md` (Block 7):**
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `PLAY_STORE_SERVICE_ACCOUNT_JSON`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `ABACATE_PAY_PROD_API_KEY`
- `FCM_SERVICE_ACCOUNT_JSON`
- `RTDN_WEBHOOK_SECRET`

**Step 4 — Commit:**
```bash
git add .github/ Dockerfile.android .dockerignore.android
git commit -m "feat(ci): port Android release + deploy workflows from memrapp"
```

---

### Task 6.2: Web deploy workflow

**Files:**
- Create: `.github/workflows/deploy-web.yml`

**Step 1 — Write workflow:**

```yaml
name: Deploy Web
on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm test
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
      # Deploy step — pick one based on user infra:
      # Option A — Vercel:
      # - run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
      # Option B — Coolify webhook:
      # - run: curl -X POST ${{ secrets.COOLIFY_DEPLOY_WEBHOOK }}
```

**Step 2 — Commit:**
```bash
git add .github/workflows/deploy-web.yml
git commit -m "feat(ci): add web deploy workflow"
```

---

### Task 6.3: Keystore generator

**Files:**
- Create: `android-signing/README.md`
- Create: `android-signing/generate-keystore.sh`
- Modify: `.gitignore` (ensure `*.keystore`, `*.jks`, `keystore.properties` ignored)

**Step 1 — Write `generate-keystore.sh`:**

```bash
#!/usr/bin/env bash
# Generate a fresh Android signing keystore for this app.
# DO NOT reuse keystores across apps — if leaked, all sharing apps are compromised.
set -euo pipefail
NAME="${1:-app-release}"
keytool -genkeypair -v \
  -keystore "android-signing/${NAME}.keystore" \
  -alias "${NAME}" \
  -keyalg RSA -keysize 2048 -validity 10000
echo "Generated android-signing/${NAME}.keystore"
echo "Now base64-encode for CI: base64 -w0 android-signing/${NAME}.keystore > keystore.base64"
echo "Add the contents of keystore.base64 to GitHub Secret KEYSTORE_BASE64"
```

**Step 2 — Write README explaining the flow.**

**Step 3 — Update `.gitignore`:**
```
android-signing/*.keystore
android-signing/*.jks
android-signing/keystore.properties
android-signing/keystore.base64
```

**Step 4 — Commit:**
```bash
git add android-signing/ .gitignore
git commit -m "feat(android): keystore generator + per-app signing docs"
```

---

## Block 7 — Documentation

### Task 7.1: Populate `.env.local` with reusable keys

**Files:**
- Modify: `.env.local`

**Step 1 — Read memrapp's `.env.local`:**
```bash
cat D:/Repos/memrapp/.env.local
```

**Step 2 — Copy ONLY test/dev keys to payment-hub `.env.local`:**

Required (reusable across apps):
- `STRIPE_SECRET_KEY=sk_test_...` (from memrapp if test, otherwise leave empty)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
- `MERCADOPAGO_ACCESS_TOKEN=` (TEST-...)
- `ABACATE_PAY_DEV_API_KEY=`

> **DO NOT copy production keys** (`sk_live_`, `pk_live_`, `ABACATE_PAY_PROD_API_KEY`). These stay empty; the user fills them per app.

**Step 3 — Verify `.env.local` is in `.gitignore`:**
```bash
grep -q "^.env.local$" .gitignore || echo ".env.local" >> .gitignore
```

**Step 4 — Commit (only `.gitignore` if changed; never `.env.local`):**
```bash
git add .gitignore
git commit -m "chore: ensure .env.local is gitignored" || true
```

---

### Task 7.2: Write comprehensive `.env.example`

**Files:**
- Modify: `.env.example`

**Step 1 — Write with grouped sections and per-key comments explaining reusable vs. per-app:**

```bash
# ============================================================
# REUSABLE ACROSS APPS — fill once, copy to .env.local for new apps
# ============================================================

# Stripe (account-level — works across apps; create new webhook + product per app)
STRIPE_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# MercadoPago (account-level)
MERCADOPAGO_ACCESS_TOKEN=TEST-xxx

# Abacate Pay (account-level)
ABACATE_PAY_ENV=dev
ABACATE_PAY_DEV_API_KEY=abc_dev_xxx

# ============================================================
# PER-APP — must be created/configured for each new app
# ============================================================

# Stripe per-app
STRIPE_AI_PRICE_ID=price_xxx                 # Create in Stripe Dashboard > Products
STRIPE_AI_ANNUAL_PRICE_ID=price_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx              # Create in Stripe Dashboard > Webhooks > <new endpoint>

# MercadoPago per-app
MERCADOPAGO_WEBHOOK_SECRET=

# Abacate Pay per-app webhook
ABACATE_PAY_WEBHOOK_SECRET=
ABACATE_PAY_PROD_API_KEY=                    # Only set after going live

# Google Play (per-app — ALL of these are app-specific)
GOOGLE_PLAY_PACKAGE_NAME=com.payment_hub.demo  # Must match app.config.ts packageName
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=             # JSON inline; see TEMPLATE.md
RTDN_WEBHOOK_SECRET=                          # Random strong string; pasted in Pub/Sub Push URL ?secret=...

# Google OAuth (per-app — must be created in Google Cloud Console with package name)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=                              # `openssl rand -base64 32`
NEXTAUTH_URL=http://localhost:3000

# FCM (per-app)
FCM_SERVICE_ACCOUNT_JSON=                     # Full service account JSON inline
NOTIFICATIONS_ADMIN_TOKEN=                    # `openssl rand -base64 32` — gates /api/notifications/send

# Database (per-app — typically Postgres in Docker)
DATABASE_URL=postgresql://payment_hub:secret@localhost:5432/payment_hub

# Admin
ADMIN_EMAILS=admin@example.com,owner@example.com

# Public
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Step 2 — Commit:**
```bash
git add .env.example
git commit -m "docs(env): comprehensive .env.example with reusable vs per-app classification"
```

---

### Task 7.3: Fill `TEMPLATE.md`

**Files:**
- Modify: `TEMPLATE.md`

**Step 1 — Replace skeleton with full content covering:**
1. What this repo is + working features
2. Replication checklist (numbered steps with copy-paste commands and console links)
3. File map with "do not modify" callout for `app/api/iap/validate-google-play/route.ts`
4. Reusable vs. per-app keys table (sourced from Task 7.2)
5. Required GitHub Secrets list (sourced from Task 6.1 step 3)
6. Required local prerequisites (Rust, Android SDK + NDK, Java 17, Docker for CI parity)

**Step 2 — Commit:**
```bash
git add TEMPLATE.md
git commit -m "docs: complete TEMPLATE.md with replication checklist and file map"
```

---

### Task 7.4: Update `README.md`

**Files:**
- Modify: `README.md`

**Step 1 — Add at top a clear pointer:** "This is a template repo. To replicate into a new app, see `TEMPLATE.md`."

**Step 2 — Add "Quick start" section with:**
- `npm install`
- `cp .env.example .env.local && fill in test keys`
- `npx prisma migrate dev`
- `npm run dev` → web at localhost:3000
- `npm run tauri:android:dev` → Android emulator

**Step 3 — Commit.**

---

## Block 8 — Validation (verification-before-completion skill)

> **REQUIRED SUB-SKILL:** Use `superpowers:verification-before-completion` for this entire block. **Do not declare success without running the commands and observing output.**

### Task 8.1: Web build + dev

**Step 1:**
```bash
cd D:/Repos/payment-hub && npm run build
```
Expected: clean build, no errors.

**Step 2:**
```bash
npm run dev
```
Open http://localhost:3000 and http://localhost:3000/paywall. Confirm web paywall renders three buttons (Stripe / MP / PIX).

---

### Task 8.2: Tauri Android emulator

**Step 1 (requires Android emulator running):**
```bash
npm run tauri:android:dev
```
Expected: app launches in emulator. Paywall shows ONLY "Assinar via Google Play".

**If this fails:** check `ANDROID_HOME`, `NDK_HOME`, `JAVA_HOME`. Document the fix in `TEMPLATE.md` troubleshooting section.

---

### Task 8.3: Webhook smoke tests

**Step 1 — Stripe (using Stripe CLI):**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook &
stripe trigger checkout.session.completed
```
Expected: webhook handler logs receipt and writes a row to `Subscription`.

**Step 2 — Abacate (manual curl with valid webhook secret):**
```bash
curl -X POST http://localhost:3000/api/pix/webhook -H "Content-Type: application/json" -d '{"event": "billing.paid", "data": {"id": "test_pix_id"}}'
```
Expected: 200 with subscription update.

---

### Task 8.4: Notification smoke test

**In Tauri Android emulator dev session:** trigger the "Send test notification" button on `/status`. Native Android notification appears.

---

### Task 8.5: CI dry run (only if user confirms)

**Step 1 — Open a PR from `feat/template-mobile` to `master` to trigger the workflows.** **Do not push without user confirmation** — this consumes Actions minutes and may upload to Play Console if `android-release.yml` triggers.

**Step 2 — Workflows that should run on PR:** `deploy-web.yml`, `deploy-android.yml` (artifact-only).

**Step 3 — `android-release.yml` is `workflow_dispatch` only — runs only when manually triggered.**

---

### Task 8.6: Final sanity pass

```bash
npx tsc --noEmit
npm run lint
git status   # should be clean
git log --oneline feat/template-mobile ^master  # all commits visible
```

**Done condition:** all 8 blocks committed, web builds, Tauri Android builds, paywall renders correctly per platform, webhooks write to DB, notification fires, CI workflows valid YAML.

---

## Risks & rollback

| Risk | If it triggers | Rollback |
|------|----------------|----------|
| Next 16 export fails | Block 3 task 3.4 | `git revert` last commit; downgrade to Next 15 (memrapp's version) |
| `tauri-plugin-iap` 0.6 incompatible | Block 3 task 3.5 or Block 5 task 5.2 | Drop the plugin, use `invoke` directly with custom Rust command |
| Prisma migration conflict | Block 1 task 1.4 | `npx prisma migrate reset` (DEV ONLY) and rewrite migration |
| Auth choice (5.4) blocks progress | Block 5 | Skip 5.4 in this iteration; ship template with `userId = 'demo-user'` placeholder; document as TODO in TEMPLATE.md |

---

## Open questions to resolve before / during execution

1. **Auth provider for the template (Task 5.4)** — NextAuth vs. Supabase Auth. Default: NextAuth.
2. **Web deploy target (Task 6.2)** — Vercel or Coolify? Default: leave both options commented.
3. **Should `.env.local` be pre-populated by Claude or by the user?** Default: by Claude using ONLY test keys from memrapp's `.env.local`. User reviews diff before committing — but `.env.local` itself is never committed.
