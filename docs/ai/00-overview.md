# AI Context — Payment Hub Template

> **Read this first.** This folder contains machine-readable docs for AI assistants integrating this template into a new app. Each file covers one concern. Read the file that matches your task.

## What this repo is

A **standalone Next.js 16 + Tauri 2 template** that ships with:

- Web checkout (Stripe, MercadoPago, PIX via Abacate Pay)
- Android app (Tauri shell) with Google Play IAP
- FCM push + local Tauri notifications
- NextAuth v5 Google OAuth
- GitHub Actions: signed APK/AAB → Play Console + Coolify web deploy

## File index

| File | Read when you need to… |
|------|------------------------|
| [01-app-config.md](01-app-config.md) | Understand the single config file; fork the template for a new app |
| [02-tauri-android.md](02-tauri-android.md) | Set up Tauri Android shell, understand the build pipeline, fix CORS issues with the production API |
| [03-payments.md](03-payments.md) | Integrate Stripe, MercadoPago, Abacate PIX, or Google Play IAP |
| [04-iap-google-play.md](04-iap-google-play.md) | Deep-dive: Google Play IAP flow from Tauri client to server validation |
| [05-notifications.md](05-notifications.md) | Add local (Tauri) or push (FCM) notifications |
| [06-auth.md](06-auth.md) | Understand NextAuth + Google OAuth setup |
| [07-database.md](07-database.md) | Prisma schema, models, how payments write to DB |
| [08-ci-cd.md](08-ci-cd.md) | Android release CI, Coolify web deploy, GitHub Secrets required |

## Key architectural rules (always apply)

1. **`app.config.ts` is the only file to edit when forking.** Nothing else should hardcode `com.payment_hub.demo`, `payment-hub`, or `payment-hub.example.com`. See [01-app-config.md](01-app-config.md).

2. **`src/app/api/iap/validate-google-play/route.ts` must keep `Access-Control-Allow-Origin: *`.** The Tauri Android app calls this endpoint from `tauri://localhost` — a non-standard origin that varies per build. Restricting CORS breaks IAP validation silently on Android. Never change this file's CORS headers.

3. **Paywall is platform-aware.** Android shows Google Play IAP only (Play Store policy). Web shows Stripe + MercadoPago + PIX. See `src/app/(mobile)/paywall/page.tsx`.

4. **All payment providers write to the same `Subscription` table** via Prisma. `provider` enum: `STRIPE | MERCADOPAGO | ABACATEPAY | GOOGLE_PLAY`.

5. **Tauri build uses static export.** `NEXT_PUBLIC_TARGET=tauri` triggers `output: 'export'` in `next.config.ts`. Server-only routes (webhooks, API) are not exported — they run on the production server, not in the APK.

## Tech stack at a glance

```
Next.js 16 (App Router) + React 19 + TypeScript
Prisma 5 → PostgreSQL
Tauri 2.9 (Rust) with plugins: iap 0.6, notification 2, deep-link 2, os 2
NextAuth v5 → Google OAuth
Firebase Admin SDK → FCM push
Stripe SDK v20 | MercadoPago SDK v2 | Abacate Pay REST API
GitHub Actions (Docker build) → Coolify
```
