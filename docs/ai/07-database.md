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
# After editing schema.prisma
npx prisma migrate dev --name describe_your_change

# Regenerate client (after migrate, or when DB is unavailable)
npx prisma generate

# View DB in browser
npx prisma studio
```

## Local database setup

```bash
# Start Postgres with Docker
docker compose up -d

# Run pending migrations
npx prisma migrate dev

# DATABASE_URL in .env.local
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/payment_hub
```
