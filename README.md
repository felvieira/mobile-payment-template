# Payment Hub

> **Template repo** — fork this to build new mobile apps with payments, IAP, notifications, and CI already wired. See [TEMPLATE.md](TEMPLATE.md) for the replication guide.

## Quick start (web)

```bash
npm install
cp .env.example .env.local  # fill in test keys
npx prisma generate
npm run dev                  # http://localhost:3000
```

Visit `/sandbox/mercadopago` or `/sandbox/stripe` to test all payment modes with live test credentials.

## Quick start (Android)

Prerequisites: Rust, Android Studio, NDK r25+, Java 17

```bash
npm run tauri:android:init   # one-time: generates src-tauri/gen/android/
node scripts/configure-android-project.js
npm run tauri:android:dev    # opens app in connected device/emulator
```

## Paywall demo

- Web: http://localhost:3000/paywall — shows Stripe / MercadoPago / PIX buttons
- Android: shows Google Play IAP button only (Play Store compliance)

---

Sistema de pagamentos universal com suporte a múltiplos gateways, IAP, notificações push e admin para gestão de pedidos.

## Payment Gateways

### MercadoPago
- Checkout Pro (redirect)
- Transparente Cartão, PIX, Boleto
- Bricks: Payment, Card, Status, Wallet (4 widgets)
- QA ↔ PROD via variável `MERCADOPAGO_ENV`

### Stripe
- Payment Intent com Elements (cartão internacional)

### Abacate PIX
- PIX QR Code via Abacate Pay
- Simulação de pagamento em modo dev

### Google Play IAP (Tauri only)
- Validação de purchase token via Google Play Developer API
- Webhooks RTDN em tempo real (Pub/Sub)
- Reconciliação diária via cron (`POST /api/cron/reconcile-google-play`)

See [docs/integrations/](./docs/integrations/) for full setup guides per gateway.

## Recursos

- **Admin Dashboard**: CRUD de produtos e listagem de pedidos
- **Loja Virtual**: Catálogo de produtos com checkout integrado
- **Webhooks**: Confirmação automática de pagamentos
- **Docker Ready**: PostgreSQL + App containerizados
- **NextAuth**: Google OAuth integrado

## Setup

### 1. Instale dependências

```bash
npm install
```

### 2. Configure variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas chaves (veja comentários no arquivo — cada var indica REUSABLE ou PER-APP).

### 3. Suba o banco de dados

```bash
docker-compose up -d postgres
```

### 4. Execute as migrations

```bash
npx prisma generate
npx prisma db push
```

### 5. Inicie o servidor

```bash
npm run dev
```

Acesse:
- **Loja**: http://localhost:3000
- **Admin**: http://localhost:3000/admin
- **Sandbox**: http://localhost:3000/sandbox/mercadopago

## Estrutura do Projeto

```
payment-hub/
├── prisma/
│   └── schema.prisma          # Schema do banco
├── docs/
│   └── integrations/          # Guias por gateway (MP, Stripe, PIX, IAP)
├── src/
│   ├── app/
│   │   ├── paywall/           # Paywall demo
│   │   ├── sandbox/           # Sandbox de testes por gateway
│   │   ├── admin/             # Dashboard admin
│   │   └── api/
│   │       ├── payments/
│   │       │   ├── stripe/        # create, webhook
│   │       │   ├── mercadopago/   # create, process-card/pix/boleto, webhook
│   │       │   └── pix/           # create, status, webhook, simulate
│   │       ├── iap/
│   │       │   ├── validate-google-play/
│   │       │   └── google-play-rtdn/
│   │       └── cron/
│   │           └── reconcile-google-play/
│   └── components/            # shadcn/ui + payment components
├── docker-compose.yml
└── Dockerfile
```

## API Reference

### Pagamentos

```bash
# Stripe — Payment Intent
POST /api/payments/stripe/create
{ "productId": "...", "customerEmail": "..." }
# → { clientSecret, orderId }

# MercadoPago — Checkout Pro
POST /api/payments/mercadopago/create
{ "productId": "...", "customerEmail": "..." }
# → { initPoint }

# MercadoPago — Transparente Cartão
POST /api/payments/mercadopago/process-card
{ "token": "...", "productId": "...", ... }

# MercadoPago — Transparente PIX
POST /api/payments/mercadopago/process-pix
{ "productId": "...", "customerEmail": "...", ... }

# MercadoPago — Transparente Boleto
POST /api/payments/mercadopago/process-boleto
{ "productId": "...", "customerEmail": "...", ... }

# Abacate PIX — QR Code
POST /api/payments/pix/create
{ "productId": "...", "customerEmail": "...", "customerPhone": "...", "customerTaxId": "..." }
# → { brCode, brCodeBase64, orderId }

GET /api/payments/pix/status?orderId=...

# Google Play IAP — Validar compra
POST /api/iap/validate-google-play
{ "productId": "...", "purchaseToken": "...", "autoRenewing": true }
```

### Webhooks

Configure nos dashboards dos providers:

- **Stripe**: `https://seudominio.com/api/payments/stripe/webhook`
- **MercadoPago**: `https://seudominio.com/api/payments/mercadopago/webhook`
- **Abacate Pay**: `https://seudominio.com/api/payments/pix/webhook`
- **Google Play RTDN**: `https://seudominio.com/api/iap/google-play-rtdn?secret=RTDN_WEBHOOK_SECRET`

## Docker (Produção)

```bash
docker-compose up -d
```

## Tecnologias

- Next.js 15 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL
- TailwindCSS
- shadcn/ui
- Tauri (Android)
- Docker

## Licença

MIT
