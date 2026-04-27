# Database — Prisma Schema and Models

## Prisma client singleton (`src/lib/db.ts`)

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export default prisma
```

Always import from `@/lib/db`:
```ts
import { prisma } from '@/lib/db'
```

## Models

### `Subscription` — active subscription state per user

```prisma
model Subscription {
  id               String          @id @default(cuid())
  userId           String
  customerEmail    String
  provider         PaymentProvider  // STRIPE | MERCADOPAGO | ABACATEPAY | GOOGLE_PLAY
  providerSubId    String           // provider-specific ID (Stripe sub id, purchaseToken, etc.)
  status           String           // active | canceled | past_due | trialing | expired | pending
  planId           String           // matches Stripe price ID or Play product ID
  currentPeriodEnd DateTime?
  rawPayload       Json?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@unique([provider, providerSubId])   // used for upsert: provider_providerSubId
  @@index([userId])
  @@index([customerEmail])
  @@index([status])
}
```

Upsert pattern (all webhooks use this):
```ts
await prisma.subscription.upsert({
  where: { provider_providerSubId: { provider: 'STRIPE', providerSubId: stripeSubId } },
  create: { userId, customerEmail, provider: 'STRIPE', providerSubId: stripeSubId, status: 'active', planId, rawPayload: event },
  update: { status: 'active', currentPeriodEnd, rawPayload: event },
})
```

### `IAPReceipt` — Google Play purchase tokens

```prisma
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
}
```

Written by `src/app/api/iap/validate-google-play/route.ts` after successful Google Play validation.

### `Order` — one-time payment orders (existing payment-hub models)

```prisma
model Order {
  id              String        @id @default(cuid())
  productId       String?
  customerEmail   String
  amount          Int            // in cents
  currency        String         @default("BRL")
  status          OrderStatus    // PENDING | PAID | FAILED | REFUNDED | EXPIRED
  paymentMethod   PaymentMethod  // CREDIT_CARD | PIX | BOLETO | IN_APP_PURCHASE
  paymentProvider PaymentProvider
  providerPaymentId String?
  paidAt          DateTime?
  expiresAt       DateTime?
  metadata        Json?
}
```

### `User` — basic profile (NextAuth)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  image     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

To add FCM token storage: add `fcmToken String?` to `User`.

## Enums

```prisma
enum PaymentProvider { STRIPE  MERCADOPAGO  ABACATEPAY  GOOGLE_PLAY }
enum PaymentMethod   { CREDIT_CARD  DEBIT_CARD  PIX  BOLETO  IN_APP_PURCHASE }
enum OrderStatus     { PENDING  PAID  FAILED  REFUNDED  EXPIRED }
```

## Common queries

```ts
// Check if user has active subscription
const sub = await prisma.subscription.findFirst({
  where: { userId, status: 'active' },
  orderBy: { createdAt: 'desc' },
})
const isPremium = !!sub

// Get all subscriptions for admin
const subs = await prisma.subscription.findMany({
  orderBy: { createdAt: 'desc' },
  take: 50,
})

// Check IAP receipt acknowledged
const receipt = await prisma.iAPReceipt.findUnique({
  where: { purchaseToken },
})
```

## Migrations

```bash
# After editing schema.prisma — creates migration file + applies locally
npm run db:migrate                               # interactive (prompts for name)
npx prisma migrate dev --name add_fcm_token      # with explicit name

# Regenerate client only (no DB needed — runs automatically on npm install)
npx prisma generate

# View DB in browser
npm run db:studio

# Reset local DB (destructive — dev only)
npm run db:reset
```

### Automatic migrations on every deploy (production)

`docker-entrypoint.sh` runs before the server starts on **every** container launch:

```sh
#!/bin/sh
set -e
npx prisma migrate deploy   # applies pending migrations — idempotent, never destructive
exec node server.js
```

`prisma migrate deploy` is safe to run repeatedly — if no pending migrations exist, it exits in milliseconds.

**Workflow for schema changes:**
1. Edit `prisma/schema.prisma`
2. `npm run db:migrate` → generates file in `prisma/migrations/`
3. Commit both `schema.prisma` + the new migration file
4. Push to `main` → Coolify redeploys → migration runs automatically before server starts

No manual SSH or psql needed.

## Local database setup

```bash
# Start Postgres + app together (migrations run automatically on app container start)
docker compose up -d

# OR: run Next.js outside Docker (faster HMR)
docker compose up db -d     # start only Postgres
npm run db:migrate          # apply migrations
npm run dev

# DATABASE_URL in .env.local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_hub
```
