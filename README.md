# Payment Hub

> **Template repo** — fork this to build new mobile apps with payments, IAP, notifications, and CI already wired. See [TEMPLATE.md](TEMPLATE.md) for the replication guide.

## Quick start (web)

```bash
npm install
cp .env.example .env.local  # fill in test keys
npx prisma generate
npm run dev                  # http://localhost:3000
```

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

Sistema de pagamentos universal com admin para loja de produtos virtuais. Suporta Stripe, Mercado Pago e PIX (Abacate Pay) com precos dinamicos.

## Recursos

- **Admin Dashboard**: CRUD de produtos e listagem de pedidos
- **Loja Virtual**: Catalogo de produtos com checkout integrado
- **3 Metodos de Pagamento**:
  - Stripe (Cartao de Credito Internacional)
  - Mercado Pago (Cartao + Parcelamento Brasil)
  - PIX via Abacate Pay (Pagamento Instantaneo com QR Code)
- **Precos Dinamicos**: Nao precisa criar produtos nos providers, apenas informe o valor
- **Webhooks**: Confirmacao automatica de pagamentos
- **Docker Ready**: PostgreSQL + App containerizados

## Quick Start

### 1. Clone e instale

```bash
cd payment-hub
npm install
```

### 2. Configure as variaveis de ambiente

```bash
cp .env.example .env
```

Edite o `.env` com suas chaves:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/paymenthub"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="APP_USR-..."
MERCADOPAGO_WEBHOOK_SECRET="..."

# Abacate Pay (PIX)
ABACATEPAY_API_KEY="..."
ABACATEPAY_WEBHOOK_SECRET="..."
NEXT_PUBLIC_ABACATEPAY_ENV="dev"  # ou "prod"

# App
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

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

## Docker (Producao)

```bash
docker-compose up -d
```

## Estrutura do Projeto

```
payment-hub/
├── prisma/
│   └── schema.prisma      # Schema do banco (Product, Order, Transaction)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Loja (catalogo)
│   │   ├── admin/page.tsx     # Dashboard admin
│   │   ├── checkout/[id]/     # Pagina de checkout
│   │   ├── success/page.tsx   # Confirmacao de pagamento
│   │   └── api/
│   │       ├── products/      # CRUD de produtos
│   │       ├── orders/        # Listagem de pedidos
│   │       └── payments/
│   │           ├── stripe/    # create, webhook
│   │           ├── mercadopago/  # create, webhook
│   │           └── pix/       # create, status, webhook, simulate
│   ├── components/ui/         # shadcn/ui components
│   ├── services/              # Business logic
│   │   ├── payment-service.ts
│   │   ├── order-service.ts
│   │   └── product-service.ts
│   └── lib/
│       ├── db.ts              # Prisma client
│       ├── stripe.ts          # Stripe SDK
│       ├── mercadopago.ts     # MP API client
│       └── abacatepay.ts      # Abacate Pay client
├── docker-compose.yml
└── Dockerfile
```

## API Reference

### Produtos

```bash
# Listar
GET /api/products

# Criar
POST /api/products
{ "name": "Produto", "price": 1990, "currency": "BRL" }

# Atualizar
PUT /api/products/:id

# Deletar
DELETE /api/products/:id
```

### Pagamentos

```bash
# Stripe
POST /api/payments/stripe/create
{ "productId": "...", "customerEmail": "..." }
# Retorna: { clientSecret, orderId }

# Mercado Pago
POST /api/payments/mercadopago/create
{ "productId": "...", "customerEmail": "..." }
# Retorna: { initPoint } -> Redirecionar usuario

# PIX (Abacate Pay - QR Code)
POST /api/payments/pix/create
{ "productId": "...", "customerEmail": "...", "customerPhone": "...", "customerTaxId": "..." }
# Retorna: { brCode, brCodeBase64, orderId }

# Verificar status PIX
GET /api/payments/pix/status?orderId=...
```

### Webhooks

Configure os endpoints nos dashboards dos providers:

- **Stripe**: `https://seudominio.com/api/payments/stripe/webhook`
- **Mercado Pago**: `https://seudominio.com/api/payments/mercadopago/webhook`
- **Abacate Pay**: `https://seudominio.com/api/payments/pix/webhook`

## Como Funciona

1. **Usuario escolhe produto** na loja
2. **Checkout** coleta dados do cliente e metodo de pagamento
3. **API cria pagamento** no provider com valor dinamico
4. **Usuario paga** (Stripe Elements, redirect MP, ou QR PIX)
5. **Webhook confirma** pagamento e atualiza pedido
6. **Pagina de sucesso** exibe confirmacao

## Obtendo as Chaves

### Stripe
1. Acesse [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers > API Keys
3. Copie a Secret Key e Publishable Key
4. Webhooks > Add endpoint > Copie o Signing Secret

### Mercado Pago
1. Acesse [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
2. Suas integracoes > Criar aplicacao
3. Credenciais > Access Token

### Abacate Pay
1. Acesse [Abacate Pay](https://abacatepay.com)
2. Crie uma conta
3. Dashboard > API Keys

## Modo de Desenvolvimento

### Para PIX (Abacate Pay)
1. Configure `NEXT_PUBLIC_ABACATEPAY_ENV=dev`
2. Um botao "Simular Pagamento" aparecera no checkout
3. Use para testar o fluxo completo sem pagamento real

## Tecnologias

- Next.js 14 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL
- TailwindCSS
- shadcn/ui
- Docker

## Licenca

MIT
