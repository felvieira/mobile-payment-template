# Payment Hub — Mobile Template Design

**Date:** 2026-04-27
**Owner:** Felipe Vieira
**Source projects:** `D:\Repos\memrapp` (Tauri shell, IAP, notifications, Abacate PIX, CI), `D:\Repos\payment-hub` (Stripe + MercadoPago base)

## Goal

Turn `D:\Repos\payment-hub` into a standalone, self-documenting, fully functional template repo. When the user starts a new mobile app, they (or an AI given this folder) can copy the structure and replicate payments, IAP, notifications, deep links, and Android CI by editing a single config file plus regenerating per-app credentials documented in `TEMPLATE.md`.

The repo runs as:
1. **Web app** (Next.js 16 SSR) — admin, web checkout (Stripe / MercadoPago / PIX Abacate)
2. **Android app** (Tauri shell, Next.js exported) — paywall via Google Play IAP, native notifications, deep links

Both share the same Next.js `app/` tree.

## Non-goals

- iOS / Apple StoreKit (not now)
- Real bible/AI content from memrapp — template is a vitrine, not a clone
- Banco Inter PIX (Abacate is enough)
- Production-grade admin features beyond what payment-hub already has

## Architecture

### Repository layout (post-changes)

```
payment-hub/
├── app/                                # Next.js (web + mobile UI shared)
│   ├── (mobile)/                       # routes that ship in Tauri (paywall, status)
│   ├── admin/                          # existing
│   ├── checkout/                       # existing (Stripe web)
│   └── api/
│       ├── stripe/webhook/             # existing, refactored
│       ├── mercadopago/webhook/        # existing
│       ├── pix/                        # NEW — copied from memrapp
│       │   ├── create-payment/
│       │   ├── check-status/
│       │   └── webhook/
│       ├── iap/
│       │   ├── validate-google-play/   # COPIED bit-for-bit, CORS * preserved
│       │   └── google-play-rtdn/       # COPIED, RTDN Pub/Sub webhook
│       └── notifications/send/         # NEW — FCM dispatch
├── src-tauri/                          # NEW — copied from memrapp
├── src/lib/payments/                   # NEW — adapters
│   ├── stripe.ts
│   ├── mercadopago.ts
│   ├── abacate.ts                      # PIX (copied from memrapp/lib/pix-payment.ts)
│   └── iap.ts                          # client-side wrapper for tauri-plugin-iap
├── src/lib/notifications/
│   ├── local.ts                        # Tauri notification plugin wrapper
│   └── push.ts                         # FCM Admin SDK
├── src/lib/auth/                       # Google OAuth — adapted from memrapp
├── prisma/schema.prisma                # extended with Subscription + IAPReceipt
├── .github/workflows/
│   ├── android-release.yml             # COPIED from memrapp, parametrized
│   ├── deploy-android.yml              # COPIED
│   └── deploy-web.yml                  # NEW
├── android-signing/                    # NEW — keystore generator + README
├── app.config.ts                       # NEW — single source of per-app config
├── TEMPLATE.md                         # NEW — instructions for AI to replicate
├── .env.local                          # gitignored — reusable keys (Stripe, MP, Abacate dev)
└── .env.example                        # placeholders + comments per key
```

### Source attribution

| Concern             | Comes from           | Why                                                  |
| ------------------- | -------------------- | ---------------------------------------------------- |
| Tauri shell         | `memrapp/src-tauri/` | Most mature, has IAP + deep-link + notification plugins wired |
| Google Play IAP     | `memrapp/app/api/iap/` | Production-validated, CORS `*` is intentional and required for Tauri |
| RTDN webhook        | `memrapp/app/api/iap/google-play-rtdn/` | Existing implementation handles Pub/Sub Push |
| PIX (Abacate Pay)   | `memrapp/lib/pix-payment.ts` + `app/api/pix/*` | User confirmed memrapp uses Abacate, not MercadoPago for PIX |
| Notifications       | `memrapp/components/notifications-manager.tsx`, `firebase/FirebaseAnalyticsBridge.kt` | Already integrated with FCM |
| Android CI          | `memrapp/.github/workflows/android-release.yml`, `deploy-android.yml` | Production-tested |
| Stripe + MercadoPago| `payment-hub` existing | Already wired, just needs adapter refactor |

### `app.config.ts` — the single point of customization

Every per-app value (name, package, deep link, product IDs, pricing, admin emails) lives here. **No file outside this one should hardcode `payment-hub` or `com.payment_hub.demo`.** When forking to a new app, the user/AI edits this file plus `.env.local` — nothing else.

```ts
export const APP_CONFIG = {
  name: 'Payment Hub Demo',
  packageName: 'com.payment_hub.demo',
  deepLinkScheme: 'payment-hub',
  productionUrl: 'https://payment-hub.example.com',
  iap: {
    monthlyProductId: 'premium_monthly',
    annualProductId: 'premium_annual',
  },
  pricing: { monthly: 9.90, annual: 79.90 },
  adminEmails: ['admin@example.com'],
}
```

Tauri config (`src-tauri/tauri.conf.json`) reads from this via the existing memrapp script `scripts/configure-android-project.js` (copied), which rewrites Android manifest schemes and identifiers based on `APP_CONFIG`.

## Payment flows

### Unified `Subscription` model (Prisma)

```prisma
enum PaymentProvider {
  stripe
  google_play
  mercadopago
  abacate_pix
}

model Subscription {
  id               String           @id @default(cuid())
  userId           String
  provider         PaymentProvider
  providerSubId    String           // Stripe sub id, GP purchaseToken, etc.
  status           String           // active | canceled | past_due | trialing
  planId           String
  currentPeriodEnd DateTime?
  rawPayload       Json
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@unique([provider, providerSubId])
  @@index([userId])
}

model IAPReceipt {
  id            String   @id @default(cuid())
  userId        String
  purchaseToken String   @unique
  productId     String
  acknowledged  Boolean  @default(false)
  rawPayload    Json
  createdAt     DateTime @default(now())
}
```

All four payment webhooks write to `Subscription` so the existing payment-hub admin UI lists everything in one view.

### Adapter interface

Each provider exposes a uniform shape so the paywall UI doesn't branch on provider internals:

```ts
interface PaymentAdapter {
  createCheckout(input: { userId: string; planId: string }): Promise<{ redirectUrl?: string; brCode?: string; brCodeBase64?: string }>
  verifyWebhook(req: Request): Promise<{ valid: boolean; event: unknown }>
  getStatus(providerSubId: string): Promise<{ status: string; currentPeriodEnd?: Date }>
}
```

### Platform-aware paywall (CRITICAL)

`app/(mobile)/paywall/page.tsx` detects the runtime:

- **Tauri / Android**: shows ONLY "Assinar via Google Play". Showing alternative payment methods on Android for digital goods violates Play Store policy and gets the app removed.
- **Web**: shows Stripe + MercadoPago + Abacate PIX.

## Notifications

- **Local**: `tauri-plugin-notification` (already in memrapp's `Cargo.toml`). `src/lib/notifications/local.ts` exposes `notify({ title, body })`.
- **Push**: FCM. Server endpoint `app/api/notifications/send/route.ts` accepts `{ userId, title, body, data }` and dispatches via Firebase Admin SDK using `FCM_SERVICE_ACCOUNT_JSON`.
- The mini-app status page has a "send test push" button that POSTs to the server endpoint targeting the current user's device token.

## CI / CD

- `android-release.yml`: builds signed APK and AAB, uploads to Play Console (track configurable). Secrets: `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON`.
- `deploy-android.yml`: same build, only PR artifact (no Play upload).
- `deploy-web.yml`: Vercel preview on PR, prod on merge to main.
- `android-signing/generate-keystore.sh` + README — every new app generates a fresh keystore (sharing keystores is a security antipattern; if leaked, all apps with the same key are compromised).

## Keys: reusable vs. per-app

Goes into `.env.local` (reusable across apps, account-level):

- `STRIPE_SECRET_KEY` (test), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test)
- `MERCADOPAGO_ACCESS_TOKEN` (test)
- `ABACATE_PAY_DEV_API_KEY`
- (Optional) shared SMTP credentials

Goes into `.env.example` only (must be created per app, console-bound):

- Stripe price IDs (`STRIPE_AI_PRICE_ID`, etc.) and `STRIPE_WEBHOOK_SECRET` (per-endpoint)
- Google OAuth client ID/secret (per package name)
- `GOOGLE_PLAY_PACKAGE_NAME` + product IDs (per app)
- `RTDN_WEBHOOK_SECRET`
- FCM project credentials
- `CRON_SECRET`, `ADMIN_EMAILS`

`TEMPLATE.md` documents which is which, with direct links to the consoles where each must be created.

## `TEMPLATE.md` outline

1. **What this repo is** — template, list of working features
2. **Replication checklist for AI / human:**
   - Edit `app.config.ts` (4 fields)
   - Console steps with direct links: Google OAuth client, Play Console product, FCM project, Stripe webhook
   - Replace IDs in `.env.local`
   - Run `node scripts/configure-android-project.js` to rename Android schemas
   - Run `android-signing/generate-keystore.sh`
   - Add GitHub Secrets (enumerated list)
3. **File map** — where each feature lives, with a "do not modify" callout for the IAP route (CORS `*` intentional)
4. **Reusable vs. per-app keys** — table

## Risks

| ID | Risk                                                  | Mitigation |
| -- | ----------------------------------------------------- | ---------- |
| R1 | Next 16 + Tauri SSG export quirks                     | Verify in Block 3; fall back to Next 15 (memrapp's version) if export breaks |
| R2 | `tauri-plugin-iap 0.6` is young                       | Already production-validated in memrapp; if it breaks here, fallback to direct `invoke` |
| R3 | Prisma schema conflict with payment-hub existing tables | Read current schema first, additive migration only |
| R4 | Accidentally copying memrapp prod keys                | Copy only test/dev keys; prod stays empty in `.env.local` |
| R5 | Large diff, hard to review                            | Commit per block (8 blocks), each with clear message and verification |

## Execution plan

Eight blocks, each a separate commit, listed in `2026-04-27-mobile-template-plan.md` (created by `writing-plans` after this design is approved).

1. Foundation — `app.config.ts`, `TEMPLATE.md` skeleton, Prisma schema additions
2. Payments — adapters + webhooks + IAP routes
3. Tauri shell — copy from memrapp, parametrize via `app.config.ts`
4. Notifications — local + FCM push
5. Mini-app paywall — `(mobile)/paywall` + `(mobile)/status`
6. CI/CD — Android workflows, web deploy, keystore generator
7. Documentation — fill `TEMPLATE.md`, populate `.env.local` and `.env.example`
8. Validation — `dev`, Tauri Android emulator, webhooks, notification, optional CI dry run

## Open decisions

None — all clarified during brainstorming:

- Template format: standalone repo with mini-app
- Mini-app fidelity: minimal viable (login + paywall + status)
- Keys strategy: hybrid (reusable in `.env.local`, per-app in `.env.example`)
- Payment mix: Stripe + Google Play IAP + MercadoPago + Abacate PIX
- PIX provider: Abacate Pay (not MercadoPago)
- Tauri base: memrapp (most mature)
