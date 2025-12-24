# Payment Hub

Sistema de pagamentos universal com admin para loja de produtos virtuais. Suporta Stripe, Mercado Pago, PIX (Abacate Pay) e pagamentos diretos via Banco Inter com precos dinamicos.

## Recursos

- **Admin Dashboard**: CRUD de produtos e listagem de pedidos
- **Loja Virtual**: Catalogo de produtos com checkout integrado
- **4 Metodos de Pagamento**:
  - Stripe (Cartao de Credito Internacional)
  - Mercado Pago (Cartao + Parcelamento Brasil)
  - PIX via Abacate Pay (Pagamento Instantaneo com QR Code)
  - **Banco Inter PIX Direto** (Pagamentos automáticos diretos)
- **Precos Dinamicos**: Nao precisa criar produtos nos providers, apenas informe o valor
- **Pagamentos Diretos**: Envie PIX diretamente usando sua conta Banco Inter (API v3)
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

# Banco Inter (PIX Direto - NOVO!)
INTER_CLIENT_ID="seu_client_id"
INTER_CLIENT_SECRET="seu_client_secret"
INTER_CERT_PATH="/path/to/cert.pem"
INTER_KEY_PATH="/path/to/key.pem"
INTER_SANDBOX="false"  # true para sandbox, false para produção

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
│   │           ├── pix/       # create, status, webhook, simulate
│   │           └── inter/     # payout, status, config (NOVO!)
│   ├── components/ui/         # shadcn/ui components
│   ├── services/              # Business logic
│   │   ├── payment-service.ts
│   │   ├── order-service.ts
│   │   ├── product-service.ts
│   │   └── inter-payout-service.ts  # Banco Inter API client (NOVO!)
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

# Banco Inter PIX Direto - NOVO!
POST /api/payments/inter/payout
{
  "amount": 5000,
  "pixKey": "email@example.com",
  "description": "Pagamento de produto",
  "idempotencyKey": "uuid-opcional",
  "metadata": { "orderId": "...", "userId": "..." }
}
# Retorna: { success, transferId, status, amount, pixKey, createdAt }

# Verificar status de transferência Inter
GET /api/payments/inter/status?transferId=...

# Verificar configuração Inter
GET /api/payments/inter/config
# Retorna: { configured, hasClientId, hasClientSecret, hasCertificates, ... }
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

### Banco Inter (PIX Direto - NOVO!)
1. Abra conta jurídica em [Banco Inter](https://www.bancointer.com.br)
2. Acesse Internet Banking > Configurações > Integrações > API
3. Crie uma nova aplicação
   - Nome: "Payment Hub"
   - Escopo: `pix.write`, `pix.read`
4. Copie **Client ID** e **Client Secret**
5. Em **Certificados Digitais**, gere novo certificado
   - Formato: PEM
   - Download arquivo .zip
   - Extrair `cert.pem` e `key.pem`
6. Defina no `.env`:
   ```env
   INTER_CLIENT_ID="seu_client_id"
   INTER_CLIENT_SECRET="seu_client_secret"
   INTER_CERT_PATH="/path/to/cert.pem"
   INTER_KEY_PATH="/path/to/key.pem"
   INTER_SANDBOX="false"
   ```

**Vantagens:**
- Sem custo: Pix é grátis para contas jurídicas
- Sem checkout: Pagamento direto, automático
- Seguro: OAuth 2.0 + mTLS
- Rápido: Pix em tempo real

## Modo de Desenvolvimento

### Para PIX (Abacate Pay)
1. Configure `NEXT_PUBLIC_ABACATEPAY_ENV=dev`
2. Um botao "Simular Pagamento" aparecera no checkout
3. Use para testar o fluxo completo sem pagamento real

### Para Banco Inter (PIX Direto)
1. Configure `INTER_SANDBOX=true` para usar ambiente de teste
2. Use credenciais de sandbox do Inter
3. Teste transferências sem gastar dinheiro real
4. Quando pronto, mude para `INTER_SANDBOX=false` para produção

## Como Usar Banco Inter (Exemplos)

### Enviar PIX Direto
```bash
curl -X POST http://localhost:3000/api/payments/inter/payout \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "pixKey": "recipient@email.com",
    "description": "Pagamento de produto",
    "idempotencyKey": "unique-uuid"
  }'
```

Resposta:
```json
{
  "success": true,
  "transferId": "inter_transfer_xyz",
  "status": "completed",
  "amount": 5000,
  "pixKey": "recipient@email.com",
  "createdAt": "2024-12-24T10:30:00Z"
}
```

### Verificar Status de Transferência
```bash
curl http://localhost:3000/api/payments/inter/status?transferId=inter_transfer_xyz
```

### Verificar Se Banco Inter Está Configurado
```bash
curl http://localhost:3000/api/payments/inter/config
```

Resposta:
```json
{
  "success": true,
  "config": {
    "configured": true,
    "hasClientId": true,
    "hasClientSecret": true,
    "hasCertificates": true,
    "sandbox": false
  }
}
```

## Casos de Uso Banco Inter

1. **Automação de Pagamentos**: Pague fornecedores, funcionários, fretistas automaticamente
2. **Marketplace**: Repasse automático para sellers
3. **Assinaturas**: Débito automático recorrente
4. **Transferências B2B**: Pagamento direto entre empresas
5. **Integrações Custom**: Use diretamente na sua app

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
