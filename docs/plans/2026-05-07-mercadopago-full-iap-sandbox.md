# MercadoPago Full + IAP Port + Sandbox Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all MercadoPago checkout modes (Checkout Pro, Transparent Card/PIX/Boleto, Bricks Payment/Card/Status/Wallet), port Google Play IAP from memrapp, build a /sandbox hub UI, remove Banco Inter, and add integration docs.

**Architecture:** Multi-env config layer (QA/PROD) in `src/lib/mercadopago/config.ts` drives all MP code. Each payment mode is an isolated component + API route. IAP is ported from memrapp adapting Supabase→Prisma. Sandbox pages are always-visible dev playgrounds with live test data.

**Tech Stack:** Next.js 15 App Router, Prisma, `@mercadopago/sdk-react`, MP SDK JS (CardForm), `google-auth-library`, Tailwind + shadcn/ui, TypeScript.

---

## Task 1: Cleanup — Remove Banco Inter

**Files:**
- Delete: `src/services/inter-payout-service.ts`
- Delete: `src/app/api/payments/inter/config/route.ts`
- Delete: `src/app/api/payments/inter/payout/route.ts`
- Delete: `src/app/api/payments/inter/status/route.ts`
- Delete: `BANCO_INTER_PAYOUT.md`
- Modify: `README.md` (remove Inter references)
- Modify: `src/services/index.ts` (remove inter export if present)

**Step 1: Delete Inter files**
```bash
rm src/services/inter-payout-service.ts
rm -rf src/app/api/payments/inter
rm BANCO_INTER_PAYOUT.md
```

**Step 2: Remove Inter export from services index**
In `src/services/index.ts`, remove any line referencing `inter-payout-service`.

**Step 3: Remove Inter from README.md**
Search and remove the Banco Inter section.

**Step 4: Verify build still compiles**
```bash
npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add -A
git commit -m "chore: remove Banco Inter — not needed in template"
```

---

## Task 2: MercadoPago Multi-Env Config

**Files:**
- Create: `src/lib/mercadopago/config.ts`
- Create: `src/lib/mercadopago/index.ts`
- Modify: `.env.example`
- Modify: `.env.local` (add QA keys, keep existing as MERCADOPAGO_ACCESS_TOKEN for compat)

**Step 1: Create `src/lib/mercadopago/config.ts`**
```typescript
// src/lib/mercadopago/config.ts
// Single source of truth for MP credentials.
// MERCADOPAGO_ENV=qa|prod controls which pair is active.

export type MPEnv = 'qa' | 'prod'

export interface MPConfig {
  accessToken: string
  publicKey: string
  env: MPEnv
  isQA: boolean
}

export function getMPConfig(): MPConfig {
  const env = (process.env.MERCADOPAGO_ENV || 'qa') as MPEnv

  if (env === 'prod') {
    const accessToken = process.env.MERCADOPAGO_PROD_ACCESS_TOKEN
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY
    if (!accessToken || !publicKey) {
      throw new Error(
        'MERCADOPAGO_PROD_ACCESS_TOKEN and NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY are required when MERCADOPAGO_ENV=prod'
      )
    }
    return { accessToken, publicKey, env: 'prod', isQA: false }
  }

  // Default: QA
  const accessToken =
    process.env.MERCADOPAGO_QA_ACCESS_TOKEN ||
    process.env.MERCADOPAGO_ACCESS_TOKEN // backward compat
  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY // backward compat

  if (!accessToken || !publicKey) {
    throw new Error(
      'MERCADOPAGO_QA_ACCESS_TOKEN and NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY are required'
    )
  }
  return { accessToken, publicKey, env: 'qa', isQA: true }
}

/** Server-side only: just the access token */
export function getMPAccessToken(): string {
  return getMPConfig().accessToken
}

/** Client-safe: just the public key */
export function getMPPublicKey(): string {
  const env = (process.env.MERCADOPAGO_ENV || 'qa') as MPEnv
  if (env === 'prod') {
    return process.env.NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY || ''
  }
  return (
    process.env.NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ||
    ''
  )
}
```

**Step 2: Create `src/lib/mercadopago/index.ts`**
```typescript
export * from './config'
export * from './checkout-pro'
export * from './payments'
export * from './webhooks'
```

**Step 3: Update `.env.example`** — replace MP section:
```env
# -----------------------------------------------------------
# MERCADOPAGO
# MERCADOPAGO_ENV=qa uses QA keys; =prod uses PROD keys.
# REUSABLE: access token + public key (per account, not per app)
# PER-APP:  webhook secret (create per deployment)
# -----------------------------------------------------------
# Dashboard: https://www.mercadopago.com.br/developers/panel/app
MERCADOPAGO_ENV=qa                                      # qa | prod

# QA (conta de teste — APP_USR-xxx)
MERCADOPAGO_QA_ACCESS_TOKEN=APP_USR-xxx                # REUSABLE
NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY=APP_USR-xxx      # REUSABLE

# PROD (conta pessoal)
MERCADOPAGO_PROD_ACCESS_TOKEN=APP_USR-xxx              # REUSABLE
NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY=APP_USR-xxx    # REUSABLE

# Webhook — gere em: Painel MP > Webhooks > Suas chaves
MERCADOPAGO_WEBHOOK_SECRET=                             # PER-APP
```

**Step 4: Update `.env.local`** — add QA keys from the provided credentials:
```env
MERCADOPAGO_ENV=qa
MERCADOPAGO_QA_ACCESS_TOKEN=APP_USR-3728834816614669-050709-31c8cd85c69065315837c2b02de8303f-3385516116
NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY=APP_USR-7dc079fa-3d44-45d6-abb6-d502fcfc9f47
MERCADOPAGO_PROD_ACCESS_TOKEN=APP_USR-626238019344901-050709-9fdf8c79b128b60716c7cef4ca7f4108-160275061
NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY=APP_USR-1b842f17-740a-4823-9951-e313450b9313
```
Keep `MERCADOPAGO_ACCESS_TOKEN` and `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` as aliases pointing to QA for backward compat with existing code while we migrate.

**Step 5: Commit**
```bash
git add src/lib/mercadopago/config.ts src/lib/mercadopago/index.ts .env.example
git commit -m "feat(mp): add QA/PROD multi-env config layer"
```

---

## Task 3: Refactor Checkout Pro to use new config

**Files:**
- Create: `src/lib/mercadopago/checkout-pro.ts`
- Modify: `src/lib/mercadopago.ts` → delegate to new module (keep for compat)
- Modify: `src/lib/payment-providers/mercadopago-provider.ts`

**Step 1: Create `src/lib/mercadopago/checkout-pro.ts`**
```typescript
// src/lib/mercadopago/checkout-pro.ts
import { getMPAccessToken } from './config'

const MP_API = 'https://api.mercadopago.com'

export interface PreferenceItem {
  id: string
  title: string
  description?: string
  quantity: number
  unit_price: number // BRL decimal, not cents
  currency_id?: string
  category_id?: string
}

export interface CreatePreferenceParams {
  items: PreferenceItem[]
  externalReference: string
  payerEmail?: string
  payerName?: string
  backUrls: { success: string; failure: string; pending: string }
  notificationUrl: string
  installments?: number
  statementDescriptor?: string
}

export interface PreferenceResult {
  id: string
  init_point: string
  sandbox_init_point: string
}

export async function createPreference(
  params: CreatePreferenceParams
): Promise<PreferenceResult> {
  const accessToken = getMPAccessToken()

  const body = {
    items: params.items.map((item) => ({
      ...item,
      currency_id: item.currency_id || 'BRL',
      category_id: item.category_id || 'services',
    })),
    payer: params.payerEmail
      ? { email: params.payerEmail, ...(params.payerName && { name: params.payerName }) }
      : undefined,
    external_reference: params.externalReference,
    back_urls: params.backUrls,
    auto_return: params.backUrls.success.includes('localhost') ? undefined : 'approved',
    notification_url: params.notificationUrl,
    payment_methods: { installments: params.installments || 12 },
    statement_descriptor: params.statementDescriptor || 'PAYMENTHUB',
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MP Checkout Pro error ${res.status}: ${err}`)
  }

  return res.json()
}
```

**Step 2: Update `src/lib/payment-providers/mercadopago-provider.ts`**
Replace the private `getAccessToken()` call with `getMPAccessToken()` import from `@/lib/mercadopago/config`.

```typescript
import { getMPAccessToken } from '@/lib/mercadopago/config'
// ...
private getAccessToken(): string {
  return getMPAccessToken()
}
```

**Step 3: Verify no TypeScript errors**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add src/lib/mercadopago/
git commit -m "feat(mp): extract checkout-pro module, wire to multi-env config"
```

---

## Task 4: MercadoPago Transparent Payments API

**Files:**
- Create: `src/lib/mercadopago/payments.ts`
- Create: `src/app/api/payments/mercadopago/process-card/route.ts`
- Create: `src/app/api/payments/mercadopago/process-pix/route.ts`
- Create: `src/app/api/payments/mercadopago/process-boleto/route.ts`
- Create: `src/app/api/payments/mercadopago/status/route.ts`

**Step 1: Create `src/lib/mercadopago/payments.ts`**
```typescript
// src/lib/mercadopago/payments.ts
// All transparent (non-redirect) payment calls via /v1/payments
import { getMPAccessToken } from './config'

const MP_API = 'https://api.mercadopago.com'

export interface MPPayerDoc {
  type: 'CPF' | 'CNPJ'
  number: string
}

export interface MPPayer {
  email: string
  first_name?: string
  last_name?: string
  identification?: MPPayerDoc
}

// ─── Card ────────────────────────────────────────────────────────────────────

export interface CreateCardPaymentParams {
  token: string          // card token from CardForm SDK
  installments: number
  paymentMethodId: string // 'master', 'visa', 'amex', 'elo', etc.
  issuerId?: string
  amount: number         // BRL decimal
  description: string
  externalReference: string
  payer: MPPayer
  statementDescriptor?: string
  notificationUrl?: string
}

export async function createCardPayment(params: CreateCardPaymentParams) {
  const accessToken = getMPAccessToken()

  const body = {
    transaction_amount: params.amount,
    token: params.token,
    description: params.description,
    installments: params.installments,
    payment_method_id: params.paymentMethodId,
    issuer_id: params.issuerId,
    payer: params.payer,
    external_reference: params.externalReference,
    statement_descriptor: params.statementDescriptor || 'PAYMENTHUB',
    notification_url: params.notificationUrl,
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': params.externalReference,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MP Card payment error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── PIX ─────────────────────────────────────────────────────────────────────

export interface CreatePixPaymentParams {
  amount: number
  description: string
  externalReference: string
  payer: MPPayer
  expirationMinutes?: number
  notificationUrl?: string
}

export async function createPixPayment(params: CreatePixPaymentParams) {
  const accessToken = getMPAccessToken()

  const expirationDate = new Date()
  expirationDate.setMinutes(
    expirationDate.getMinutes() + (params.expirationMinutes || 30)
  )

  const body = {
    transaction_amount: params.amount,
    description: params.description,
    payment_method_id: 'pix',
    payer: params.payer,
    external_reference: params.externalReference,
    date_of_expiration: expirationDate.toISOString(),
    notification_url: params.notificationUrl,
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `pix-${params.externalReference}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MP PIX error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── Boleto ───────────────────────────────────────────────────────────────────

export interface CreateBoletoPaymentParams {
  amount: number
  description: string
  externalReference: string
  payer: MPPayer & { address?: { street_name: string; street_number: string; zip_code: string } }
  daysUntilExpiration?: number
  notificationUrl?: string
}

export async function createBoletoPayment(params: CreateBoletoPaymentParams) {
  const accessToken = getMPAccessToken()

  const expirationDate = new Date()
  expirationDate.setDate(
    expirationDate.getDate() + (params.daysUntilExpiration || 3)
  )

  const body = {
    transaction_amount: params.amount,
    description: params.description,
    payment_method_id: 'bolbradesco',
    payer: params.payer,
    external_reference: params.externalReference,
    date_of_expiration: expirationDate.toISOString(),
    notification_url: params.notificationUrl,
  }

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': `boleto-${params.externalReference}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`MP Boleto error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── Get Payment ─────────────────────────────────────────────────────────────

export async function getMPPayment(paymentId: string) {
  const accessToken = getMPAccessToken()
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`MP get payment error ${res.status}`)
  return res.json()
}
```

**Step 2: Create `src/app/api/payments/mercadopago/process-card/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, errorResponse } from '@/lib/api-middleware'
import { createCardPayment } from '@/lib/mercadopago/payments'
import { prisma } from '@/lib/db'

async function handler(req: NextRequest) {
  const { token, installments, paymentMethodId, issuerId, productId, 
          customerEmail, customerName, customerTaxId } = await req.json()

  if (!token || !installments || !paymentMethodId || !productId || !customerEmail) {
    return errorResponse('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return errorResponse('Product not found', 404, 'NOT_FOUND')

  const order = await prisma.order.create({
    data: {
      productId: product.id,
      customerEmail,
      customerName,
      amount: product.price,
      currency: product.currency,
      status: 'PENDING',
      paymentMethod: 'CREDIT_CARD',
      paymentProvider: 'MERCADOPAGO',
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const [firstName, ...lastParts] = (customerName || customerEmail).split(' ')

  const payment = await createCardPayment({
    token,
    installments: Number(installments),
    paymentMethodId,
    issuerId,
    amount: product.price / 100,
    description: product.name,
    externalReference: order.id,
    payer: {
      email: customerEmail,
      first_name: firstName,
      last_name: lastParts.join(' ') || undefined,
      ...(customerTaxId && { identification: { type: 'CPF', number: customerTaxId } }),
    },
    notificationUrl: `${baseUrl}/api/payments/mercadopago/webhook`,
  })

  // Map MP status to our status
  const statusMap: Record<string, 'PAID' | 'FAILED' | 'PENDING'> = {
    approved: 'PAID',
    rejected: 'FAILED',
    pending: 'PENDING',
    in_process: 'PENDING',
  }
  const newStatus = statusMap[payment.status] || 'PENDING'

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: newStatus,
      providerPaymentId: String(payment.id),
      ...(newStatus === 'PAID' && { paidAt: new Date() }),
    },
  })

  return NextResponse.json({
    orderId: order.id,
    paymentId: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    redirectUrl: newStatus === 'PAID'
      ? `${baseUrl}/success?orderId=${order.id}`
      : undefined,
  })
}

export const POST = withErrorHandler(handler)
```

**Step 3: Create `src/app/api/payments/mercadopago/process-pix/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, errorResponse } from '@/lib/api-middleware'
import { createPixPayment } from '@/lib/mercadopago/payments'
import { prisma } from '@/lib/db'

async function handler(req: NextRequest) {
  const { productId, customerEmail, customerName, customerTaxId } = await req.json()

  if (!productId || !customerEmail) {
    return errorResponse('Missing required fields', 400, 'VALIDATION_ERROR')
  }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return errorResponse('Product not found', 404, 'NOT_FOUND')

  const order = await prisma.order.create({
    data: {
      productId: product.id,
      customerEmail,
      customerName,
      amount: product.price,
      currency: product.currency,
      status: 'PENDING',
      paymentMethod: 'PIX',
      paymentProvider: 'MERCADOPAGO',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const [firstName, ...lastParts] = (customerName || customerEmail).split(' ')

  const payment = await createPixPayment({
    amount: product.price / 100,
    description: product.name,
    externalReference: order.id,
    payer: {
      email: customerEmail,
      first_name: firstName,
      last_name: lastParts.join(' ') || undefined,
      ...(customerTaxId && { identification: { type: 'CPF', number: customerTaxId } }),
    },
    expirationMinutes: 30,
    notificationUrl: `${baseUrl}/api/payments/mercadopago/webhook`,
  })

  await prisma.order.update({
    where: { id: order.id },
    data: { providerPaymentId: String(payment.id) },
  })

  return NextResponse.json({
    orderId: order.id,
    paymentId: payment.id,
    status: payment.status,
    qrCode: payment.point_of_interaction?.transaction_data?.qr_code,
    qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
    ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url,
  })
}

export const POST = withErrorHandler(handler)
```

**Step 4: Create `src/app/api/payments/mercadopago/process-boleto/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { withErrorHandler, errorResponse } from '@/lib/api-middleware'
import { createBoletoPayment } from '@/lib/mercadopago/payments'
import { prisma } from '@/lib/db'

async function handler(req: NextRequest) {
  const { productId, customerEmail, customerName, customerTaxId } = await req.json()

  if (!productId || !customerEmail || !customerTaxId) {
    return errorResponse('CPF é obrigatório para boleto', 400, 'VALIDATION_ERROR')
  }

  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return errorResponse('Product not found', 404, 'NOT_FOUND')

  const order = await prisma.order.create({
    data: {
      productId: product.id,
      customerEmail,
      customerName,
      customerTaxId,
      amount: product.price,
      currency: product.currency,
      status: 'PENDING',
      paymentMethod: 'BOLETO',
      paymentProvider: 'MERCADOPAGO',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
  })

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const [firstName, ...lastParts] = (customerName || customerEmail).split(' ')

  const payment = await createBoletoPayment({
    amount: product.price / 100,
    description: product.name,
    externalReference: order.id,
    payer: {
      email: customerEmail,
      first_name: firstName,
      last_name: lastParts.join(' ') || undefined,
      identification: { type: 'CPF', number: customerTaxId },
    },
    daysUntilExpiration: 3,
    notificationUrl: `${baseUrl}/api/payments/mercadopago/webhook`,
  })

  await prisma.order.update({
    where: { id: order.id },
    data: { providerPaymentId: String(payment.id) },
  })

  return NextResponse.json({
    orderId: order.id,
    paymentId: payment.id,
    status: payment.status,
    barcodeContent: payment.barcode?.content,
    externalResourceUrl: payment.transaction_details?.external_resource_url,
    digitableLine: payment.transaction_details?.digitable_line,
    expiresAt: order.expiresAt,
  })
}

export const POST = withErrorHandler(handler)
```

**Step 5: Create `src/app/api/payments/mercadopago/status/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getMPPayment } from '@/lib/mercadopago/payments'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const paymentId = searchParams.get('paymentId')
  const orderId = searchParams.get('orderId')

  if (!paymentId && !orderId) {
    return NextResponse.json({ error: 'paymentId or orderId required' }, { status: 400 })
  }

  let mpPaymentId = paymentId
  if (!mpPaymentId && orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    mpPaymentId = order?.providerPaymentId || null
  }

  if (!mpPaymentId) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const payment = await getMPPayment(mpPaymentId)

  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    paymentMethodId: payment.payment_method_id,
    amount: payment.transaction_amount,
  })
}
```

**Step 6: Compile check and commit**
```bash
npx tsc --noEmit
git add src/lib/mercadopago/payments.ts src/app/api/payments/mercadopago/
git commit -m "feat(mp): add transparent card/pix/boleto + status API routes"
```

---

## Task 5: MercadoPago Webhook — Unify

**Files:**
- Create: `src/lib/mercadopago/webhooks.ts`
- Modify: `src/app/api/payments/mercadopago/webhook/route.ts`

**Step 1: Create `src/lib/mercadopago/webhooks.ts`**
```typescript
import crypto from 'crypto'

export function validateMPWebhookSignature(
  xSignature: string,
  xRequestId: string,
  dataId: string,
  secret: string
): boolean {
  const parts = xSignature.split(',')
  const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1]
  const hash = parts.find((p) => p.startsWith('v1='))?.split('=')[1]
  if (!ts || !hash) return false

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const calculated = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))
}
```

**Step 2: Update webhook route** to use `validateMPWebhookSignature` and `getMPAccessToken` from new config, and handle all payment types (card approval, PIX, boleto).

**Step 3: Commit**
```bash
git add src/lib/mercadopago/webhooks.ts src/app/api/payments/mercadopago/webhook/
git commit -m "feat(mp): unify webhook handler with new config layer"
```

---

## Task 6: Install Bricks SDK + Create MP Components

**Files:**
- Modify: `package.json` (install `@mercadopago/sdk-react`)
- Create: `src/components/payments/mercadopago/CheckoutProButton.tsx`
- Create: `src/components/payments/mercadopago/TransparentCardForm.tsx`
- Create: `src/components/payments/mercadopago/TransparentPixQR.tsx`
- Create: `src/components/payments/mercadopago/TransparentBoleto.tsx`
- Create: `src/components/payments/mercadopago/BricksPayment.tsx`
- Create: `src/components/payments/mercadopago/BricksCard.tsx`
- Create: `src/components/payments/mercadopago/BricksStatus.tsx`
- Create: `src/components/payments/mercadopago/BricksWallet.tsx`
- Create: `src/components/payments/mercadopago/index.ts`

**Step 1: Install SDK**
```bash
npm install @mercadopago/sdk-react
```

**Step 2: Create `src/components/payments/mercadopago/CheckoutProButton.tsx`**
```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Props {
  productId: string
  customerEmail: string
  customerName?: string
  label?: string
  className?: string
  onError?: (err: string) => void
}

export function CheckoutProButton({
  productId, customerEmail, customerName, label = 'Pagar com Mercado Pago',
  className, onError
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!customerEmail) { onError?.('Email obrigatório'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, customerEmail, customerName, installments: 12 }),
      })
      const data = await res.json()
      if (data.initPoint) {
        window.location.href = data.initPoint
      } else {
        onError?.(data.error || 'Erro ao criar preferência')
      }
    } catch (e) {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} className={className}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  )
}
```

**Step 3: Create `src/components/payments/mercadopago/TransparentCardForm.tsx`**

This component uses the MP SDK JS CardForm loaded via script tag (avoids SSR issues with `@mercadopago/sdk-react` CardForm):

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface Props {
  productId: string
  publicKey: string
  amount: number // BRL decimal
  onSuccess?: (data: { orderId: string; paymentId: string; status: string }) => void
  onError?: (err: string) => void
}

declare global {
  interface Window {
    MercadoPago: any
  }
}

export function TransparentCardForm({ productId, publicKey, amount, onSuccess, onError }: Props) {
  const formRef = useRef<HTMLDivElement>(null)
  const [email, setEmail] = useState('')
  const [taxId, setTaxId] = useState('')
  const [name, setName] = useState('')
  const [installments, setInstallments] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const mpRef = useRef<any>(null)
  const cardFormRef = useRef<any>(null)

  useEffect(() => {
    // Load MP SDK JS
    if (document.getElementById('mp-sdk')) {
      if (window.MercadoPago) initForm()
      return
    }
    const script = document.createElement('script')
    script.id = 'mp-sdk'
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = initForm
    document.head.appendChild(script)

    return () => {
      cardFormRef.current?.unmount()
    }
  }, [publicKey])

  function initForm() {
    mpRef.current = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
    cardFormRef.current = mpRef.current.cardForm({
      amount: String(amount),
      iframe: true,
      form: {
        id: 'mp-card-form',
        cardNumber: { id: 'mp-card-number', placeholder: 'Número do cartão' },
        expirationDate: { id: 'mp-expiration', placeholder: 'MM/YY' },
        securityCode: { id: 'mp-cvv', placeholder: 'CVV' },
        cardholderName: { id: 'mp-holder-name', placeholder: 'Nome no cartão' },
        issuer: { id: 'mp-issuer' },
        installments: { id: 'mp-installments' },
        identificationType: { id: 'mp-doc-type' },
        identificationNumber: { id: 'mp-doc-number', placeholder: 'CPF' },
        cardholderEmail: { id: 'mp-email', placeholder: 'Email' },
      },
      callbacks: {
        onFormMounted: (err: any) => { if (!err) setSdkReady(true) },
        onSubmit: async (event: any) => {
          event.preventDefault()
          const {
            paymentMethodId, issuerId, cardholderEmail, token,
            installments: inst, identificationNumber,
          } = cardFormRef.current.getCardFormData()
          await processCardPayment({ token, installments: inst, paymentMethodId, issuerId,
            customerEmail: cardholderEmail, customerTaxId: identificationNumber })
        },
      },
    })
  }

  async function processCardPayment(data: any) {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/process-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, productId, customerName: name }),
      })
      const result = await res.json()
      if (res.ok) {
        onSuccess?.({ orderId: result.orderId, paymentId: result.paymentId, status: result.status })
      } else {
        onError?.(result.error || 'Pagamento recusado')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form id="mp-card-form" onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div id="mp-card-number" className="border rounded-md p-3 h-12" />
      <div className="grid grid-cols-2 gap-4">
        <div id="mp-expiration" className="border rounded-md p-3 h-12" />
        <div id="mp-cvv" className="border rounded-md p-3 h-12" />
      </div>
      <div id="mp-holder-name" className="border rounded-md p-3 h-12" />
      <div className="grid grid-cols-2 gap-4">
        <div id="mp-doc-type" className="border rounded-md h-12" />
        <div id="mp-doc-number" className="border rounded-md p-3 h-12" />
      </div>
      <select id="mp-installments" className="border rounded-md p-3 h-12 w-full text-sm" />
      <div id="mp-issuer" hidden />
      <div id="mp-email" hidden />
      <Button type="submit" disabled={loading || !sdkReady} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {sdkReady ? 'Pagar com cartão' : 'Carregando...'}
      </Button>
    </form>
  )
}
```

**Step 4: Create `src/components/payments/mercadopago/TransparentPixQR.tsx`**
```tsx
'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check, Loader2, QrCode } from 'lucide-react'

interface Props {
  productId: string
  onSuccess?: (orderId: string) => void
  onError?: (err: string) => void
}

export function TransparentPixQR({ productId, onSuccess, onError }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [pix, setPix] = useState<{
    orderId: string; paymentId: string; qrCode: string; qrCodeBase64: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pollStatus, setPollStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!pix || pollStatus === 'approved') return
    const iv = setInterval(async () => {
      const res = await fetch(`/api/payments/mercadopago/status?paymentId=${pix.paymentId}`)
      const data = await res.json()
      setPollStatus(data.status)
      if (data.status === 'approved') {
        clearInterval(iv)
        onSuccess?.(pix.orderId)
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [pix, pollStatus])

  async function handleCreate() {
    if (!email) { onError?.('Email obrigatório'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/process-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, customerEmail: email, customerName: name, customerTaxId: taxId }),
      })
      const data = await res.json()
      if (res.ok) setPix(data)
      else onError?.(data.error || 'Erro ao gerar PIX')
    } catch { onError?.('Erro de rede') }
    finally { setLoading(false) }
  }

  function copyCode() {
    if (pix?.qrCode) {
      navigator.clipboard.writeText(pix.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (pix) return (
    <div className="space-y-4 text-center">
      {pollStatus === 'approved'
        ? <p className="text-green-600 font-semibold">✅ PIX recebido!</p>
        : <p className="text-sm text-muted-foreground animate-pulse">Aguardando pagamento…</p>
      }
      {pix.qrCodeBase64 && (
        <img src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code PIX" className="mx-auto w-48 h-48 border rounded-lg" />
      )}
      <Button variant="outline" onClick={copyCode} className="w-full">
        {copied ? <><Check className="mr-2 h-4 w-4" />Copiado!</> : <><Copy className="mr-2 h-4 w-4" />Copiar código</>}
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div><Label>Email *</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
      <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" /></div>
      <div><Label>CPF</Label><Input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="12345678909" /></div>
      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <QrCode className="mr-2 h-4 w-4" />Gerar QR Code PIX
      </Button>
    </div>
  )
}
```

**Step 5: Create `src/components/payments/mercadopago/TransparentBoleto.tsx`**
```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react'

interface Props {
  productId: string
  onError?: (err: string) => void
}

export function TransparentBoleto({ productId, onError }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [boleto, setBoleto] = useState<{
    orderId: string; digitableLine?: string; externalResourceUrl?: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!email || !taxId) { onError?.('Email e CPF são obrigatórios'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/process-boleto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, customerEmail: email, customerName: name, customerTaxId: taxId }),
      })
      const data = await res.json()
      if (res.ok) setBoleto(data)
      else onError?.(data.error || 'Erro ao gerar boleto')
    } catch { onError?.('Erro de rede') }
    finally { setLoading(false) }
  }

  function copyLine() {
    if (boleto?.digitableLine) {
      navigator.clipboard.writeText(boleto.digitableLine)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (boleto) return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Boleto gerado com sucesso! Vence em 3 dias úteis.</p>
      {boleto.digitableLine && (
        <div className="space-y-2">
          <Label>Linha digitável</Label>
          <div className="flex gap-2">
            <Input value={boleto.digitableLine} readOnly className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={copyLine}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
      {boleto.externalResourceUrl && (
        <Button variant="outline" className="w-full" asChild>
          <a href={boleto.externalResourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />Abrir boleto PDF
          </a>
        </Button>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div><Label>Email *</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
      <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" /></div>
      <div><Label>CPF *</Label><Input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="12345678909" /></div>
      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Gerar boleto
      </Button>
    </div>
  )
}
```

**Step 6: Create Bricks components**

`src/components/payments/mercadopago/BricksPayment.tsx`:
```tsx
'use client'
import { useEffect, useRef } from 'react'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  preferenceId: string
  onSuccess?: (payment: any) => void
  onError?: (err: any) => void
  onReady?: () => void
}

// NOTE: initMercadoPago must be called once per app.
// Best to call it in a top-level layout or once per page.
let mpInitialized = false

export function BricksPayment({ publicKey, preferenceId, onSuccess, onError, onReady }: Props) {
  if (!mpInitialized) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }

  const initialization = {
    amount: 0, // Will be overridden by preferenceId
    preferenceId,
  }

  const customization = {
    paymentMethods: {
      ticket: 'all',
      bankTransfer: 'all',
      creditCard: 'all',
      debitCard: 'all',
      mercadoPago: 'all',
    },
  }

  return (
    <Payment
      initialization={initialization}
      customization={customization as any}
      onSubmit={async (param) => {
        // param.formData has all the payment data
        // For Bricks, the payment is processed by MP after submit
        onSuccess?.(param)
      }}
      onError={onError}
      onReady={onReady}
    />
  )
}
```

`src/components/payments/mercadopago/BricksCard.tsx`:
```tsx
'use client'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  amount: number
  onSuccess?: (data: any) => void
  onError?: (err: any) => void
}

let mpInitialized = false

export function BricksCard({ publicKey, amount, onSuccess, onError }: Props) {
  if (!mpInitialized) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }

  return (
    <CardPayment
      initialization={{ amount }}
      onSubmit={async (formData) => {
        onSuccess?.(formData)
      }}
      onError={onError}
    />
  )
}
```

`src/components/payments/mercadopago/BricksStatus.tsx`:
```tsx
'use client'
import { initMercadoPago, StatusScreen } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  paymentId: string
}

let mpInitialized = false

export function BricksStatus({ publicKey, paymentId }: Props) {
  if (!mpInitialized) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }
  return <StatusScreen initialization={{ paymentId }} />
}
```

`src/components/payments/mercadopago/BricksWallet.tsx`:
```tsx
'use client'
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  preferenceId: string
  label?: string
}

let mpInitialized = false

export function BricksWallet({ publicKey, preferenceId, label }: Props) {
  if (!mpInitialized) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }
  return (
    <Wallet
      initialization={{ preferenceId, redirectMode: 'blank' }}
      customization={{ texts: { valueProp: 'smart_option' } }}
    />
  )
}
```

**Step 7: Create `src/components/payments/mercadopago/index.ts`**
```typescript
export { CheckoutProButton } from './CheckoutProButton'
export { TransparentCardForm } from './TransparentCardForm'
export { TransparentPixQR } from './TransparentPixQR'
export { TransparentBoleto } from './TransparentBoleto'
export { BricksPayment } from './BricksPayment'
export { BricksCard } from './BricksCard'
export { BricksStatus } from './BricksStatus'
export { BricksWallet } from './BricksWallet'
```

**Step 8: Compile check and commit**
```bash
npx tsc --noEmit
git add src/components/payments/mercadopago/ package.json package-lock.json
git commit -m "feat(mp): add all 8 payment mode components (CheckoutPro, Transparent*, Bricks*)"
```

---

## Task 7: Sandbox Hub + MercadoPago Sandbox Page

**Files:**
- Create: `src/app/sandbox/page.tsx`
- Create: `src/app/sandbox/layout.tsx`
- Create: `src/app/sandbox/_components/EnvBadge.tsx`
- Create: `src/app/sandbox/_components/TestCardsTable.tsx`
- Create: `src/app/sandbox/_components/GatewayCard.tsx`
- Create: `src/app/sandbox/mercadopago/page.tsx`
- Create: `src/app/sandbox/stripe/page.tsx`
- Create: `src/app/sandbox/abacate/page.tsx`
- Create: `src/app/sandbox/google-play/page.tsx`
- Create: `src/app/api/sandbox/config/route.ts` (returns env status per gateway)

**Step 1: Create `src/app/api/sandbox/config/route.ts`**
```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    mercadopago: {
      configured: !!(process.env.MERCADOPAGO_QA_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN),
      env: process.env.MERCADOPAGO_ENV || 'qa',
    },
    stripe: {
      configured: !!process.env.STRIPE_SECRET_KEY,
      env: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live',
    },
    abacate: {
      configured: !!(process.env.ABACATE_PAY_DEV_API_KEY || process.env.ABACATE_PAY_PROD_API_KEY),
      env: process.env.ABACATE_PAY_ENV || 'dev',
    },
    googlePlay: {
      configured: !!process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
      env: 'tauri-only',
    },
  })
}
```

**Step 2: Create `src/app/sandbox/_components/EnvBadge.tsx`**
```tsx
interface Props { env: string }
export function EnvBadge({ env }: Props) {
  const colors: Record<string, string> = {
    qa: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    prod: 'bg-red-100 text-red-800 border-red-200',
    test: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    live: 'bg-red-100 text-red-800 border-red-200',
    dev: 'bg-blue-100 text-blue-800 border-blue-200',
    'tauri-only': 'bg-purple-100 text-purple-800 border-purple-200',
  }
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${colors[env] || 'bg-gray-100 text-gray-700'}`}>
      {env}
    </span>
  )
}
```

**Step 3: Create `src/app/sandbox/_components/TestCardsTable.tsx`**
```tsx
import { Copy } from 'lucide-react'

const CARDS = [
  { brand: 'Mastercard', number: '5031 4332 1540 6351', cvv: '123', expiry: '11/30' },
  { brand: 'Visa',       number: '4235 6477 2802 5682', cvv: '123', expiry: '11/30' },
  { brand: 'AmEx',       number: '3753 651535 56885',   cvv: '1234', expiry: '11/30' },
  { brand: 'Elo Débito', number: '5067 7667 8388 8311', cvv: '123', expiry: '11/30' },
]

const CPF_MAP = [
  { cpf: '12345678909', status: 'APRO', desc: 'Aprovado' },
  { cpf: '12345678909', status: 'OTHE', desc: 'Recusado (erro geral)' },
]

export function TestCardsTable() {
  function copy(text: string) { navigator.clipboard.writeText(text) }

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h3 className="font-semibold mb-2">🃏 Cartões de teste</h3>
        <table className="w-full border text-xs">
          <thead className="bg-muted">
            <tr>{['Bandeira','Número','CVV','Validade'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {CARDS.map(c => (
              <tr key={c.number} className="border-t hover:bg-muted/40">
                <td className="p-2">{c.brand}</td>
                <td className="p-2 font-mono flex items-center gap-1">
                  {c.number}
                  <button onClick={() => copy(c.number.replace(/ /g,''))} className="opacity-50 hover:opacity-100"><Copy className="h-3 w-3" /></button>
                </td>
                <td className="p-2 font-mono">{c.cvv}</td>
                <td className="p-2 font-mono">{c.expiry}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="font-semibold mb-2">🆔 CPFs de teste</h3>
        <table className="w-full border text-xs">
          <thead className="bg-muted">
            <tr>{['CPF','Status','Descrição'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {CPF_MAP.map(c => (
              <tr key={c.status} className="border-t">
                <td className="p-2 font-mono flex items-center gap-1">
                  {c.cpf}
                  <button onClick={() => copy(c.cpf)} className="opacity-50 hover:opacity-100"><Copy className="h-3 w-3" /></button>
                </td>
                <td className="p-2 font-mono">{c.status}</td>
                <td className="p-2">{c.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="font-semibold mb-2">👤 Usuários de teste</h3>
        <p className="text-xs text-muted-foreground">Seller: TESTUSER8540916956785474261 / mkEI0Mg28y</p>
        <p className="text-xs text-muted-foreground">Buyer: TESTUSER1533392031803184682 / sbEE8c3ikt</p>
      </div>
    </div>
  )
}
```

**Step 4: Create `src/app/sandbox/page.tsx`** (the hub)
```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { EnvBadge } from './_components/EnvBadge'

interface GatewayStatus { configured: boolean; env: string }
interface Config {
  mercadopago: GatewayStatus
  stripe: GatewayStatus
  abacate: GatewayStatus
  googlePlay: GatewayStatus
}

const GATEWAYS = [
  { key: 'mercadopago', name: 'MercadoPago', href: '/sandbox/mercadopago',
    modes: ['Checkout Pro', 'Transparente (Cartão/PIX/Boleto)', 'Bricks (7 modos)'] },
  { key: 'stripe', name: 'Stripe', href: '/sandbox/stripe',
    modes: ['Payment Elements', 'Card Element', 'Checkout Session'] },
  { key: 'abacate', name: 'Abacate PIX', href: '/sandbox/abacate',
    modes: ['PIX QR Code', 'PIX Copia-Cola'] },
  { key: 'googlePlay', name: 'Google Play IAP', href: '/sandbox/google-play',
    modes: ['Validate Purchase', 'RTDN Webhook', 'Tauri Plugin'] },
]

export default function SandboxPage() {
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    fetch('/api/sandbox/config').then(r => r.json()).then(setConfig)
  }, [])

  return (
    <div className="container max-w-3xl py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Payment Hub — Sandbox</h1>
        <p className="text-muted-foreground mt-1">
          Teste todos os gateways de pagamento disponíveis neste template.
        </p>
      </div>
      <div className="grid gap-4">
        {GATEWAYS.map(gw => {
          const status = config?.[gw.key as keyof Config]
          return (
            <Card key={gw.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {status?.configured
                      ? <CheckCircle className="h-5 w-5 text-green-500" />
                      : <AlertCircle className="h-5 w-5 text-yellow-500" />}
                    {gw.name}
                  </CardTitle>
                  {status && <EnvBadge env={status.env} />}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {gw.modes.map(m => (
                    <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                  ))}
                </div>
                <Button asChild size="sm" variant={status?.configured ? 'default' : 'outline'}>
                  <Link href={gw.href}>
                    {status?.configured ? 'Abrir sandbox' : 'Ver setup'}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 5: Create `src/app/sandbox/mercadopago/page.tsx`**

This page has tabs for all 8 MP modes plus a test data sidebar:

```tsx
'use client'
import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { EnvBadge } from '../_components/EnvBadge'
import { TestCardsTable } from '../_components/TestCardsTable'
import { CheckoutProButton } from '@/components/payments/mercadopago/CheckoutProButton'
import { TransparentCardForm } from '@/components/payments/mercadopago/TransparentCardForm'
import { TransparentPixQR } from '@/components/payments/mercadopago/TransparentPixQR'
import { TransparentBoleto } from '@/components/payments/mercadopago/TransparentBoleto'

// Bricks need a valid preferenceId and amount — we use a demo product
const DEMO_PRODUCT_ID = 'demo' // Will be replaced with a real seeded product in setup

export default function MPSandboxPage() {
  const [env, setEnv] = useState<string>('qa')
  const [publicKey, setPublicKey] = useState<string>('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sandbox/config').then(r => r.json()).then(c => {
      setEnv(c.mercadopago.env)
      // Public key is set via env var — the component reads NEXT_PUBLIC_* directly
      setPublicKey(
        process.env.NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY ||
        process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || ''
      )
    })
  }, [])

  function onSuccess(data: any) {
    setError(null)
    setResult(JSON.stringify(data, null, 2))
  }
  function onError(err: string) {
    setResult(null)
    setError(err)
  }

  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => {
      const list = d.products || d
      setProducts(list)
      if (list[0]) setSelectedProduct(list[0].id)
    })
  }, [])

  return (
    <div className="container max-w-5xl py-10">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">MercadoPago Sandbox</h1>
        <EnvBadge env={env} />
      </div>

      {products.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm font-medium">Produto para teste:</label>
          <select
            className="border rounded p-2 text-sm"
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
          >
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} — R${(p.price / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}

      {result && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <AlertDescription>
            <pre className="text-xs overflow-auto">{result}</pre>
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="checkout-pro">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              <TabsTrigger value="checkout-pro">Checkout Pro</TabsTrigger>
              <TabsTrigger value="transparent-card">Cartão</TabsTrigger>
              <TabsTrigger value="transparent-pix">PIX</TabsTrigger>
              <TabsTrigger value="transparent-boleto">Boleto</TabsTrigger>
              <TabsTrigger value="bricks-payment">Bricks Payment</TabsTrigger>
              <TabsTrigger value="bricks-card">Bricks Card</TabsTrigger>
              <TabsTrigger value="bricks-status">Bricks Status</TabsTrigger>
              <TabsTrigger value="bricks-wallet">Bricks Wallet</TabsTrigger>
            </TabsList>

            <TabsContent value="checkout-pro">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Pro (redirect)</CardTitle>
                  <CardDescription>
                    Cria uma preferência e redireciona para o domínio do MercadoPago.
                    Suporta todos os métodos de pagamento da conta MP do comprador.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input className="border rounded p-2 w-full text-sm" placeholder="Email do comprador" id="mp-email-pro" />
                  <CheckoutProButton
                    productId={selectedProduct}
                    customerEmail={(document?.getElementById('mp-email-pro') as HTMLInputElement)?.value || 'test@test.com'}
                    onError={onError}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Em QA, use o Buyer Test User para simular pagamentos.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transparent-card">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Transparente — Cartão</CardTitle>
                  <CardDescription>
                    Formulário no seu domínio. Tokenização via CardForm SDK do MP.
                    POST /api/payments/mercadopago/process-card
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TransparentCardForm
                    productId={selectedProduct}
                    publicKey={publicKey}
                    amount={10.00}
                    onSuccess={onSuccess}
                    onError={onError}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transparent-pix">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Transparente — PIX</CardTitle>
                  <CardDescription>
                    Gera QR Code PIX no seu domínio via API MP Orders.
                    Polling automático a cada 5s.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TransparentPixQR
                    productId={selectedProduct}
                    onSuccess={(orderId) => onSuccess({ orderId, status: 'approved' })}
                    onError={onError}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transparent-boleto">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Transparente — Boleto</CardTitle>
                  <CardDescription>
                    Gera boleto bancário no seu domínio. Vence em 3 dias úteis.
                    CPF é obrigatório.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TransparentBoleto productId={selectedProduct} onError={onError} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-payment">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Payment Brick</CardTitle>
                  <CardDescription>
                    Widget unificado do MP: cartão + PIX + boleto + conta MP.
                    Requer um preferenceId criado previamente.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Crie uma preferência primeiro via Checkout Pro, copie o ID e cole aqui.
                  </p>
                  <input className="border rounded p-2 w-full text-sm mt-2" placeholder="preference_id" id="pref-id-input" />
                  <div id="bricks-payment-container" className="mt-4" />
                  {/* BricksPayment is lazy-loaded to avoid SSR issues */}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-card">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Card Payment Brick</CardTitle>
                  <CardDescription>Widget de cartão gerenciado pelo MP.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div id="bricks-card-container" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-status">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Status Screen</CardTitle>
                  <CardDescription>Tela de resultado gerenciada pelo MP.</CardDescription>
                </CardHeader>
                <CardContent>
                  <input className="border rounded p-2 w-full text-sm" placeholder="Payment ID" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-wallet">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Wallet (Pagar com MP)</CardTitle>
                  <CardDescription>Botão de login na conta MercadoPago.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div id="bricks-wallet-container" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Dados de teste</CardTitle></CardHeader>
            <CardContent>
              <TestCardsTable />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Links úteis</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-xs">
              <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">→ Painel MP</a>
              <a href="https://www.mercadopago.com.br/developers/pt/docs" target="_blank" rel="noopener noreferrer" className="block text-blue-600 hover:underline">→ Docs oficiais</a>
              <a href="/docs/integrations/mercadopago" target="_blank" className="block text-blue-600 hover:underline">→ Guia de integração</a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

**Step 6: Create placeholder sandbox pages for other gateways**

`src/app/sandbox/stripe/page.tsx`, `src/app/sandbox/abacate/page.tsx`, `src/app/sandbox/google-play/page.tsx` — each with a "coming soon / setup guide" card pointing to the docs.

**Step 7: Commit**
```bash
git add src/app/sandbox/ src/app/api/sandbox/
git commit -m "feat(sandbox): add hub page + MP full sandbox (8 modes) + gateway placeholders"
```

---

## Task 8: Port Google Play IAP from memrapp

**Files:**
- Create: `src/lib/google-play/validator.ts` (from memrapp `lib/google-play-validator.ts`)
- Create: `src/lib/google-play/subscription-config.ts` (adapted from memrapp)
- Create: `src/lib/google-play/index.ts`
- Create: `src/app/api/iap/validate-google-play/route.ts` (adapted, Supabase→NextAuth+Prisma)
- Create: `src/app/api/iap/google-play-rtdn/route.ts` (adapted)
- Create: `src/app/api/iap/pending-purchase/route.ts`
- Create: `src/app/api/cron/reconcile-google-play/route.ts` (adapted)
- Create: `src/hooks/use-subscription.ts` (adapted)
- Modify: `prisma/schema.prisma` (add `cancelAtPeriodEnd`, `purchaseToken`, `platform`, `productId` fields to Subscription model + migration)

**Step 1: Update Prisma schema — add IAP fields to Subscription**

Current Subscription model is missing: `purchaseToken`, `platform`, `cancelAtPeriodEnd`, `productId`, `source`. Add them:

```prisma
model Subscription {
  id                String          @id @default(cuid())
  userId            String
  customerEmail     String
  provider          PaymentProvider
  providerSubId     String
  status            String          // active | canceled | expired | past_due
  planId            String
  platform          String?         // web | google_play | app_store
  source            String?         // web | app
  productId         String?         // Google Play product ID
  purchaseToken     String?         // Google Play purchase token
  cancelAtPeriodEnd Boolean         @default(false)
  currentPeriodStart DateTime?
  currentPeriodEnd  DateTime?
  rawPayload        Json?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@unique([provider, providerSubId])
  @@index([userId])
  @@index([customerEmail])
  @@index([status])
  @@index([purchaseToken])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_iap_fields_to_subscription
```

**Step 2: Create `src/lib/google-play/validator.ts`**

Copy `D:\Repos\memrapp\lib\google-play-validator.ts` verbatim — it has zero Supabase dependencies.

**Step 3: Create `src/lib/google-play/subscription-config.ts`**
```typescript
// Adapted from memrapp — uses NEXT_PUBLIC_* pattern from payment-hub

export const GOOGLE_PLAY_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || 'app_premium_monthly'

export const GOOGLE_PLAY_ANNUAL_PRODUCT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_ANNUAL_PRODUCT_ID || 'app_premium_annual'

export const VALID_GOOGLE_PLAY_PRODUCT_IDS = [
  GOOGLE_PLAY_PRODUCT_ID,
  GOOGLE_PLAY_ANNUAL_PRODUCT_ID,
]

export type SubscriptionPlan = 'monthly' | 'annual'

export function getGooglePlayProductId(plan: SubscriptionPlan): string {
  if (plan === 'annual') return GOOGLE_PLAY_ANNUAL_PRODUCT_ID
  return GOOGLE_PLAY_PRODUCT_ID
}

export const GOOGLE_PLAY_PACKAGE_NAME =
  process.env.GOOGLE_PLAY_PACKAGE_NAME ||
  process.env.NEXT_PUBLIC_GOOGLE_PLAY_PACKAGE_NAME ||
  'com.your_app.demo'
```

**Step 4: Create `src/app/api/iap/validate-google-play/route.ts`**

Adapted from memrapp: replace Supabase auth with NextAuth `getServerSession`, replace `upsertSubscriptionByUserId` with Prisma upsert:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { validateGooglePlaySubscription } from '@/lib/google-play/validator'
import { GOOGLE_PLAY_PACKAGE_NAME, VALID_GOOGLE_PLAY_PRODUCT_IDS } from '@/lib/google-play/subscription-config'

// CORS for Tauri app
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: cors })
}

export async function POST(req: NextRequest) {
  try {
    const { productId, purchaseToken, autoRenewing } = await req.json()

    if (!productId || !purchaseToken)
      return NextResponse.json({ error: 'Missing productId or purchaseToken' }, { status: 400, headers: cors })

    if (!VALID_GOOGLE_PLAY_PRODUCT_IDS.includes(productId))
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400, headers: cors })

    // Auth — support both cookie (web) and Bearer token (Tauri)
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      // Tauri: look up user by decoding the JWT from NextAuth
      // Simple approach: look up session via token
      // (In practice, generate a custom API token stored in your DB)
      // For now, use NextAuth session fallback
    }
    const session = await getServerSession(authOptions)
    userId = session?.user?.id || null

    if (!userId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors })

    const result = await validateGooglePlaySubscription(GOOGLE_PLAY_PACKAGE_NAME, productId, purchaseToken)

    if (!result.isValid && !result.error?.includes('not configured'))
      return NextResponse.json({ error: 'Invalid purchase' }, { status: 400, headers: cors })

    const now = new Date()
    const periodEnd = result.isValid
      ? result.expiryDate
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // fallback: +30 days

    const user = await prisma.user.findUnique({ where: { id: userId } })

    await prisma.subscription.upsert({
      where: { provider_providerSubId: { provider: 'GOOGLE_PLAY', providerSubId: purchaseToken } },
      update: {
        status: 'active',
        platform: 'google_play',
        source: 'app',
        productId,
        purchaseToken,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: !autoRenewing,
        updatedAt: now,
      },
      create: {
        userId,
        customerEmail: user?.email || '',
        provider: 'GOOGLE_PLAY',
        providerSubId: purchaseToken,
        status: 'active',
        planId: productId,
        platform: 'google_play',
        source: 'app',
        productId,
        purchaseToken,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: !autoRenewing,
      },
    })

    return NextResponse.json({
      success: true,
      subscription: { status: 'active', platform: 'google_play', currentPeriodEnd: periodEnd.toISOString() }
    }, { headers: cors })
  } catch (err) {
    console.error('[IAP]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: cors })
  }
}
```

**Step 5: Create `src/app/api/iap/google-play-rtdn/route.ts`**

Port from memrapp replacing `query/queryOne` with Prisma and `upsertSubscriptionByUserId` with Prisma upsert:

```typescript
// Key differences from memrapp:
// - No saveWebhookLog helper — log to console + prisma.transaction instead
// - No query/queryOne — use prisma.subscription.findFirst
// - upsertSubscriptionByUserId → prisma.subscription.upsert
```

Core RTDN logic (NOTIFICATION_TYPES map, ACTIVE_TYPES, INACTIVE_TYPES sets, Pub/Sub decode) is identical to memrapp. Only DB layer changes.

**Step 6: Create `src/app/api/cron/reconcile-google-play/route.ts`**

Port from memrapp — same logic, replace `query` with `prisma.subscription.findMany` and raw SQL updates with `prisma.subscription.update`.

**Step 7: Create `src/hooks/use-subscription.ts`**

Port from memrapp `lib/hooks/use-subscription.ts` — it's a React hook with no Supabase dependency (just fetch calls), so it's mostly a copy.

**Step 8: Run migration and type-check**
```bash
npx prisma migrate dev --name add_iap_fields_to_subscription
npx tsc --noEmit
```

**Step 9: Commit**
```bash
git add src/lib/google-play/ src/app/api/iap/ src/app/api/cron/ src/hooks/ prisma/
git commit -m "feat(iap): port Google Play IAP from memrapp (validator, RTDN, reconcile, hook)"
```

---

## Task 9: Update env examples + .env.local for IAP

**Files:**
- Modify: `.env.example` (add IAP product IDs)
- Modify: `.env.prod.example`
- Modify: `.env.local` (update MP keys, add IAP product env vars)

**Step 1: Add to `.env.example`** under Google Play IAP section:
```env
# Product IDs — create in Play Console > Monetização > Assinaturas
NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID=app_premium_monthly      # PER-APP
NEXT_PUBLIC_GOOGLE_PLAY_ANNUAL_PRODUCT_ID=app_premium_annual # PER-APP
```

**Step 2: Commit**
```bash
git add .env.example .env.prod.example
git commit -m "chore(env): add IAP product ID vars to examples"
```

---

## Task 10: Integration Docs

**Files:**
- Create: `docs/integrations/README.md`
- Create: `docs/integrations/mercadopago.md`
- Create: `docs/integrations/stripe.md`
- Create: `docs/integrations/abacate-pix.md`
- Create: `docs/integrations/google-play-iap.md`

**Step 1: Create `docs/integrations/README.md`** — master checklist for new project setup.

**Step 2: Create `docs/integrations/mercadopago.md`** — full guide:
```markdown
# MercadoPago Integration Guide

## Modos suportados
| Modo | Arquivo | Endpoint | Redirect? |
|------|---------|----------|-----------|
| Checkout Pro | `CheckoutProButton` | POST /api/payments/mercadopago/create | ✅ sim |
| Transparente Cartão | `TransparentCardForm` | POST /api/payments/mercadopago/process-card | ❌ não |
| Transparente PIX | `TransparentPixQR` | POST /api/payments/mercadopago/process-pix | ❌ não |
| Transparente Boleto | `TransparentBoleto` | POST /api/payments/mercadopago/process-boleto | ❌ não |
| Bricks Payment | `BricksPayment` | (MP gerencia) | ❌ não |
| Bricks Card | `BricksCard` | (MP gerencia) | ❌ não |
| Bricks Status | `BricksStatus` | (MP gerencia) | ❌ não |
| Bricks Wallet | `BricksWallet` | (MP gerencia) | sim |

## REUSABLE (criar 1x, copiar entre apps)
- `MERCADOPAGO_QA_ACCESS_TOKEN` — token da conta QA
- `NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY` — public key QA
- `MERCADOPAGO_PROD_ACCESS_TOKEN` — token da conta prod
- `NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY` — public key prod

## PER-APP (criar para cada novo projeto)
- [ ] Criar app no painel: https://www.mercadopago.com.br/developers/panel/app
- [ ] Configurar webhook URL: `https://your-domain/api/payments/mercadopago/webhook`
- [ ] Copiar `MERCADOPAGO_WEBHOOK_SECRET` em Webhooks > "Suas chaves secretas"
- [ ] Configurar `MERCADOPAGO_ENV=prod` no deploy

## Ambientes
- Trocar QA→PROD: mude apenas `MERCADOPAGO_ENV=prod`
- Sandbox: acesse `/sandbox/mercadopago`

## Cartões de teste (QA)
[tabela completa — ver TestCardsTable.tsx]

## CPFs de teste
| CPF | Status | Resultado |
|-----|--------|-----------|
| 12345678909 | APRO | Aprovado |
| 12345678909 | OTHE | Recusado |

## Usuários de teste
- Seller: TESTUSER8540916956785474261 / mkEI0Mg28y
- Buyer: TESTUSER1533392031803184682 / sbEE8c3ikt

## Troubleshooting
- `400 Invalid card token`: SDK CardForm não inicializou — verifique NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY
- `401`: Access token errado ou expirado
- Webhook não recebe: verifique se o URL está público e o secret está configurado
```

**Step 3: Create skeleton docs** for Stripe, Abacate PIX, Google Play IAP.

**Step 4: Commit**
```bash
git add docs/integrations/
git commit -m "docs: add integration guides for all gateways (MP full, others skeleton)"
```

---

## Task 11: Final cleanup + README update

**Files:**
- Modify: `README.md`
- Modify: `PLAN.md` (mark items done)

**Step 1: Update README** with new `/sandbox` route, list of all MP modes, IAP support note, and link to `docs/integrations/`.

**Step 2: Final type-check and build test**
```bash
npx tsc --noEmit
npm run build 2>&1 | tail -30
```

**Step 3: Final commit**
```bash
git add README.md PLAN.md
git commit -m "docs: update README with sandbox, all MP modes, IAP, integration guides"
```

---

## Task 12: Push to origin

```bash
git push origin main
```

---

## Summary of changes

| Category | Files created | Files modified |
|----------|-------------|----------------|
| MP config layer | `src/lib/mercadopago/config.ts`, `checkout-pro.ts`, `payments.ts`, `webhooks.ts`, `index.ts` | `src/lib/mercadopago.ts`, `mercadopago-provider.ts` |
| MP API routes | `process-card/`, `process-pix/`, `process-boleto/`, `status/` | `create/`, `webhook/` |
| MP components | 8 components in `src/components/payments/mercadopago/` | — |
| Sandbox UI | `src/app/sandbox/**` (6 pages + 3 components) | — |
| IAP | `src/lib/google-play/**`, `src/app/api/iap/**`, `src/app/api/cron/reconcile-google-play/`, `src/hooks/use-subscription.ts` | `prisma/schema.prisma` |
| Docs | `docs/integrations/*.md` (5 files) | `README.md`, `.env.example`, `.env.prod.example` |
| Cleanup | — | Delete Banco Inter files |

**Estimated ~35 files created, ~10 modified.**
