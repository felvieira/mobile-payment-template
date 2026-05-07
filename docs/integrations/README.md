# Integration Guides

Este diretório contém guias para cada gateway de pagamento suportado pelo template.

## Gateways suportados

| Gateway | Modos | Status |
|---------|-------|--------|
| [MercadoPago](./mercadopago.md) | Checkout Pro, Transparente (Cartão/PIX/Boleto), Bricks (4 widgets) | ✅ Completo |
| [Stripe](./stripe.md) | Payment Intent, Elements | ✅ Completo |
| [Abacate PIX](./abacate-pix.md) | PIX QR Code | ✅ Completo |
| [Google Play IAP](./google-play-iap.md) | Subscription validation, RTDN, Reconcile | ✅ Completo (Tauri only) |

## Checklist para novo projeto

Ao clonar este template e criar um novo app, siga estes passos:

### 1. Setup base
- [ ] `cp .env.example .env.local` e preencha DATABASE_URL
- [ ] `npm install && npx prisma migrate dev`
- [ ] Configure NextAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET)

### 2. MercadoPago (se usar)
- [ ] Acesse https://www.mercadopago.com.br/developers/panel/app
- [ ] Crie um app (ou use a conta QA para testes)
- [ ] Copie Access Token e Public Key para `.env.local` (QA ou PROD conforme `MERCADOPAGO_ENV`)
- [ ] Configure webhook: `https://seu-dominio/api/payments/mercadopago/webhook`
- [ ] Copie `MERCADOPAGO_WEBHOOK_SECRET` do painel de Webhooks
- [ ] Teste em `/sandbox/mercadopago`

### 3. Stripe (se usar)
- [ ] Crie conta/projeto em https://dashboard.stripe.com
- [ ] Copie `STRIPE_SECRET_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Crie produtos e copie `STRIPE_AI_PRICE_ID`
- [ ] Configure webhook e copie `STRIPE_WEBHOOK_SECRET`

### 4. Abacate PIX (se usar)
- [ ] Crie conta em https://dash.abacatepay.com
- [ ] Copie `ABACATE_PAY_DEV_API_KEY` (dev) ou `ABACATE_PAY_PROD_API_KEY` (prod)
- [ ] Configure webhook e copie `ABACATE_PAY_WEBHOOK_SECRET`

### 5. Google Play IAP (se usar — requer app Tauri)
- [ ] Crie app no Google Play Console com package name correto
- [ ] Configure Service Account com androidpublisher API
- [ ] Crie produtos de assinatura (monthly/annual)
- [ ] Configure RTDN via Pub/Sub: `https://seu-dominio/api/iap/google-play-rtdn?secret=RTDN_WEBHOOK_SECRET`
- [ ] Defina `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `RTDN_WEBHOOK_SECRET`
- [ ] Defina `NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID` e `NEXT_PUBLIC_GOOGLE_PLAY_ANNUAL_PRODUCT_ID`

### 6. Deploy
- [ ] Configure todas as vars de produção no seu hosting (Coolify, Vercel, Railway, etc.)
- [ ] Mude `MERCADOPAGO_ENV=prod` se usar MercadoPago em produção
- [ ] Configure `CRON_SECRET` e agende `POST /api/cron/reconcile-google-play` diariamente
