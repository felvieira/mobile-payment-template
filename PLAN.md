# Payment Hub - Plano de Ação

## Visão Geral

Sistema de pagamentos universal em Next.js com admin para loja de produtos virtuais. Objetivo: qualquer pessoa configura as API keys e tem um sistema de pagamentos funcionando.

## Requisitos

### Funcionalidades Core
1. **Admin Dashboard** - Cadastro de produtos com preço
2. **Checkout Universal** - Frontend envia produto/valor, backend processa
3. **3 Provedores de Pagamento**:
   - Stripe (cartão) - pagamento dinâmico sem pré-criar produtos
   - Mercado Pago (cartão + PIX) - preferências dinâmicas
   - Abacate Pay (PIX) - QR code dinâmico
4. **Webhooks** - Confirmação automática de pagamentos
5. **Banco de Dados** - PostgreSQL para produtos, pedidos, transações

### Configuração Simples
- Arquivo `.env` com todas as chaves
- Docker Compose para subir tudo
- Zero configuração no dashboard dos provedores (exceto webhooks)

## Arquitetura

```
payment-hub/
├── docker-compose.yml
├── .env.example
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Landing/Loja
│   │   ├── admin/
│   │   │   ├── page.tsx             # Dashboard admin
│   │   │   └── products/
│   │   │       └── page.tsx         # CRUD produtos
│   │   ├── checkout/
│   │   │   └── [productId]/
│   │   │       └── page.tsx         # Checkout do produto
│   │   └── api/
│   │       ├── products/
│   │       │   └── route.ts         # CRUD API
│   │       ├── payments/
│   │       │   ├── stripe/
│   │       │   │   ├── create/route.ts
│   │       │   │   └── webhook/route.ts
│   │       │   ├── mercadopago/
│   │       │   │   ├── create/route.ts
│   │       │   │   └── webhook/route.ts
│   │       │   └── pix/
│   │       │       ├── create/route.ts
│   │       │       ├── status/route.ts
│   │       │       └── webhook/route.ts
│   │       └── orders/
│   │           └── route.ts
│   ├── components/
│   │   ├── admin/
│   │   │   ├── ProductForm.tsx
│   │   │   ├── ProductList.tsx
│   │   │   └── OrdersList.tsx
│   │   ├── checkout/
│   │   │   ├── PaymentSelector.tsx
│   │   │   ├── StripeCheckout.tsx
│   │   │   ├── MercadoPagoCheckout.tsx
│   │   │   └── PixCheckout.tsx
│   │   └── ui/
│   │       └── ...shadcn components
│   ├── lib/
│   │   ├── db.ts                    # Prisma client
│   │   ├── stripe.ts                # Stripe SDK
│   │   ├── mercadopago.ts           # MP SDK
│   │   └── abacatepay.ts            # Abacate Pay client
│   └── types/
│       └── index.ts
└── README.md
```

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript |
| Estilização | TailwindCSS + shadcn/ui |
| Banco de Dados | PostgreSQL |
| ORM | Prisma |
| Containerização | Docker + Docker Compose |
| Pagamentos | Stripe, Mercado Pago, Abacate Pay |

## Schema do Banco (Prisma)

```prisma
model Product {
  id          String   @id @default(cuid())
  name        String
  description String?
  price       Int      // em centavos
  currency    String   @default("BRL")
  imageUrl    String?
  active      Boolean  @default(true)
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  orders      Order[]
}

model Order {
  id              String   @id @default(cuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  customerEmail   String
  customerName    String?
  amount          Int      // em centavos
  currency        String   @default("BRL")
  status          OrderStatus @default(PENDING)
  paymentMethod   PaymentMethod
  paymentId       String?  // ID do provedor
  paidAt          DateTime?
  metadata        Json?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  transactions    Transaction[]
}

model Transaction {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])
  provider        PaymentProvider
  providerTxId    String   // ID no provedor
  status          String
  amount          Int
  rawResponse     Json?
  createdAt       DateTime @default(now())
}

enum OrderStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
  EXPIRED
}

enum PaymentMethod {
  CREDIT_CARD
  PIX
  BOLETO
}

enum PaymentProvider {
  STRIPE
  MERCADOPAGO
  ABACATEPAY
}
```

## Variáveis de Ambiente

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/payment_hub"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_PASSWORD="admin123"  # Senha simples para demo

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN="TEST-..."
MERCADOPAGO_WEBHOOK_SECRET="..."
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY="TEST-..."

# Abacate Pay (PIX)
ABACATEPAY_API_KEY="abc_dev_..."
ABACATEPAY_WEBHOOK_SECRET="..."
```

## Fluxo de Pagamento Universal

### 1. Stripe (Cartão)
```
Frontend → POST /api/payments/stripe/create
  Body: { productId, customerEmail, customerName }

Backend:
  1. Busca produto no banco
  2. Cria Payment Intent com amount dinâmico
  3. Cria Order com status PENDING
  4. Retorna clientSecret

Frontend:
  5. Usa Stripe Elements para coletar cartão
  6. Confirma pagamento

Webhook → POST /api/payments/stripe/webhook
  7. Recebe payment_intent.succeeded
  8. Atualiza Order para PAID
```

### 2. Mercado Pago (Cartão/PIX)
```
Frontend → POST /api/payments/mercadopago/create
  Body: { productId, customerEmail, customerName, installments? }

Backend:
  1. Busca produto no banco
  2. Cria Preference com amount dinâmico (sem product ID no MP)
  3. Cria Order com status PENDING
  4. Retorna init_point (URL checkout)

Frontend:
  5. Redireciona para Mercado Pago ou abre modal
  6. Usuário paga

Webhook → POST /api/payments/mercadopago/webhook
  7. Recebe payment notification
  8. Busca detalhes do pagamento
  9. Atualiza Order para PAID
```

### 3. Abacate Pay (PIX)
```
Frontend → POST /api/payments/pix/create
  Body: { productId, customerEmail, customerName, customerPhone?, customerTaxId? }

Backend:
  1. Busca produto no banco
  2. Cria QR Code PIX com amount dinâmico
  3. Cria Order com status PENDING
  4. Retorna brCode, brCodeBase64, expiresAt

Frontend:
  5. Mostra QR Code
  6. Inicia polling em /api/payments/pix/status

Webhook → POST /api/payments/pix/webhook
  7. Recebe billing.paid
  8. Atualiza Order para PAID

Polling → GET /api/payments/pix/status?orderId=xxx
  9. Retorna status atual
```

## Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/payment_hub
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: payment_hub
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

## Tarefas de Implementação

### Fase 1: Setup Base
1. [ ] Criar projeto Next.js 14 com TypeScript
2. [ ] Configurar TailwindCSS + shadcn/ui
3. [ ] Configurar Prisma + PostgreSQL
4. [ ] Criar docker-compose.yml
5. [ ] Criar schema Prisma e rodar migrations

### Fase 2: Admin Dashboard
6. [ ] Página de login admin (simples com senha)
7. [ ] CRUD de produtos (API + UI)
8. [ ] Lista de pedidos com status
9. [ ] Dashboard com métricas básicas

### Fase 3: Loja/Checkout
10. [ ] Página de loja listando produtos
11. [ ] Página de checkout com seletor de pagamento
12. [ ] Componente de seleção de método de pagamento

### Fase 4: Stripe Integration
13. [ ] API create payment intent (dinâmico)
14. [ ] Webhook handler
15. [ ] Componente StripeCheckout com Elements
16. [ ] Página de sucesso

### Fase 5: Mercado Pago Integration
17. [ ] API create preference (dinâmico)
18. [ ] Webhook handler
19. [ ] Componente MercadoPagoCheckout
20. [ ] Redirect flow

### Fase 6: Abacate Pay (PIX) Integration
21. [ ] API create PIX QR code
22. [ ] API check status (polling)
23. [ ] Webhook handler
24. [ ] Componente PixCheckout com QR code

### Fase 7: Polimento
25. [ ] Página de sucesso universal
26. [ ] Emails de confirmação (opcional)
27. [ ] Documentação README
28. [ ] Testes manuais de todos os fluxos

## Diferenças do Sistema Atual (PosterFlix)

| Aspecto | PosterFlix | Payment Hub |
|---------|------------|-------------|
| Backend | Supabase Edge Functions | Next.js API Routes |
| Produtos | Hardcoded/banco | CRUD dinâmico |
| Preços Stripe | Price IDs pré-criados | Dinâmico (amount) |
| Preços MP | Hardcoded | Dinâmico (amount) |
| Auth | Supabase Auth | Senha simples |
| Propósito | Específico (posters) | Universal |

## Como Usar (Usuário Final)

1. Clone o repositório
2. Copie `.env.example` para `.env`
3. Configure suas API keys dos provedores
4. `docker-compose up -d`
5. `npx prisma migrate deploy`
6. Acesse `http://localhost:3000/admin`
7. Cadastre produtos
8. Compartilhe link da loja

## Considerações de Segurança

- Webhooks validados com assinatura
- Idempotência para evitar pagamentos duplicados
- HTTPS obrigatório em produção
- Chaves separadas para teste/produção
- Senha admin em variável de ambiente
