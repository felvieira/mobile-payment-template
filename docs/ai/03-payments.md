# Payments — Stripe, MercadoPago, Abacate PIX, Google Play IAP

## Architecture

All providers implement the same `PaymentAdapter` interface (`src/lib/payments/types.ts`):

```ts
interface PaymentAdapter {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  verifyWebhook(req: Request): Promise<WebhookVerification>
  getStatus(providerSubId: string): Promise<SubscriptionStatus>
}
```

All successful payments write to the `Subscription` Prisma model with a `PaymentProvider` enum discriminant.

## Provider map

| Provider | Adapter | Webhook route | When to use |
|----------|---------|---------------|-------------|
| Stripe | `src/lib/payments/stripe.ts` | `src/app/api/payments/stripe/webhook/route.ts` | Web — card subscriptions |
| MercadoPago | `src/lib/payments/mercadopago.ts` | `src/app/api/payments/mercadopago/webhook/route.ts` | Web — Brazil card + PIX (alternative) |
| Abacate Pay | `src/lib/payments/abacate.ts` | `src/app/api/pix/webhook/route.ts` | Web — PIX (preferred for annual plans) |
| Google Play IAP | `src/lib/payments/iap.ts` (client) + `src/app/api/iap/validate-google-play/route.ts` (server) | `src/app/api/iap/google-play-rtdn/route.ts` (RTDN) | Android only |

## Platform rule (critical for Play Store compliance)

```tsx
// src/app/(mobile)/paywall/page.tsx
if (plat === 'android') {
  // Android: Google Play ONLY — Play Store policy forbids alternative payment methods
  return <button onClick={buyIap}>Assinar via Google Play</button>
}
// Web: all methods
return <> <button onClick={buyStripe}>Cartão</button> <button onClick={buyMP}>MP</button> <button onClick={buyPix}>PIX</button> </>
```

**Never show Stripe/MP/PIX buttons inside the Android APK.** Google will reject the app.

---

## Stripe

### Checkout flow (web)
```ts
// POST /api/stripe/checkout (or use stripeAdapter directly)
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: planId, quantity: 1 }],
  customer_email: customerEmail,
  success_url: `${NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${NEXT_PUBLIC_SITE_URL}/paywall`,
  metadata: { userId },
})
// → return session.url to client, client redirects
```

### Webhook
Stripe sends `checkout.session.completed` and `customer.subscription.updated` to `/api/payments/stripe/webhook`.

The route verifies with `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` then upserts `Subscription` with `provider: 'STRIPE'`.

### Env vars
```
STRIPE_SECRET_KEY=sk_test_...         # account-level, reusable
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...       # per-app: create one endpoint per app in Stripe Dashboard
STRIPE_AI_PRICE_ID=price_...          # per-app: create product in Stripe
STRIPE_AI_ANNUAL_PRICE_ID=price_...
```

---

## MercadoPago

### Checkout flow
```ts
// Uses PreApproval (subscription) from mercadopago SDK
const preapproval = new PreApproval(client)
const result = await preapproval.create({
  body: {
    preapproval_plan_id: planId,   // must exist in MP dashboard
    payer_email: customerEmail,
    back_url: `${NEXT_PUBLIC_SITE_URL}/success`,
    external_reference: userId,
  }
})
// → return result.init_point to client
```

### Webhook
MP sends `x-signature` header: `ts=<timestamp>;v1=<hmac>`. The route verifies with HMAC-SHA256 and upserts `Subscription` with `provider: 'MERCADOPAGO'`.

### Env vars
```
MERCADOPAGO_ACCESS_TOKEN=TEST-...    # account-level, reusable
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=TEST-...
MERCADOPAGO_WEBHOOK_SECRET=          # per-app
```

---

## Abacate Pay (PIX)

### Overview
Abacate Pay provides a **transparent PIX API** — returns `brCode` (text for copy-paste) and `brCodeBase64` (PNG QR code) directly, no redirect needed.

Has two API versions with automatic fallback:
- v2 transparent (`/v2/transparents/create`) — preferred
- v1 QR code (`/v1/pixQrCode/create`) — fallback if v2 fails

### Checkout flow
```ts
// POST /api/pix/create-payment
const result = await createAbacatePixPayment(userId, customerEmail)
// → { brCode: "00020126...", brCodeBase64: "data:image/png;base64,...", providerSubId: "pix_id" }
// Client renders QR code inline, polls /api/pix/check-status?id=<providerSubId>
```

### Status polling
```ts
// GET /api/pix/check-status?id=<abacatePaymentId>
const status = await checkAbacatePixStatus(id)
// status.data.status: 'PENDING' | 'PAID' | 'EXPIRED'
```

### Webhook
Abacate calls `/api/pix/webhook` when PIX is paid. Verifies `webhookSecret` header, updates `Subscription.status` to `'active'`.

### Env vars
```
ABACATE_PAY_ENV=dev                  # 'dev' or 'prod'
ABACATE_PAY_DEV_API_KEY=abc_dev_...  # account-level, reusable across apps
ABACATE_PAY_PROD_API_KEY=abc_prod_.. # account-level, reusable
ABACATE_PAY_WEBHOOK_SECRET=          # per-app (random string you choose)
```

---

## How payments write to the database

Every provider writes to the `Subscription` model:

```prisma
model Subscription {
  id               String          @id @default(cuid())
  userId           String
  customerEmail    String
  provider         PaymentProvider  // STRIPE | MERCADOPAGO | ABACATEPAY | GOOGLE_PLAY
  providerSubId    String           // Stripe sub id, MP preapproval id, Abacate PIX id, GP purchaseToken
  status           String           // active | canceled | past_due | trialing | expired | pending
  planId           String
  currentPeriodEnd DateTime?
  rawPayload       Json?

  @@unique([provider, providerSubId])
  @@index([userId])
}
```

Query pattern (check active sub for a user):
```ts
const sub = await prisma.subscription.findFirst({
  where: { userId, status: 'active' },
  orderBy: { createdAt: 'desc' },
})
```

## Adding a new payment provider

1. Create `src/lib/payments/yourprovider.ts` implementing `PaymentAdapter`
2. Add `YOURPROVIDER` to the `PaymentProvider` enum in `prisma/schema.prisma`
3. Run `npx prisma migrate dev --name add_yourprovider`
4. Create webhook route at `src/app/api/yourprovider/webhook/route.ts`
5. Add button to paywall page (web-only unless it's an Android IAP)
