# Stripe Integration Guide

Stripe é o gateway internacional padrão. Suporta cartão de crédito/débito, ApplePay/GooglePay, boletos, transferências bancárias internacionais e subscriptions recorrentes. Aqui usamos **Payment Intents + Stripe Elements** para checkout transparente no seu domínio.

## Modos suportados

| Modo | Componente | Endpoint | Descrição |
|------|-----------|----------|-----------|
| Payment Elements | `StripeElementsForm` | `POST /api/payments/stripe/create` | Form embutido com PaymentIntent |
| Webhook | — | `POST /api/payments/stripe/webhook` | Confirmação assíncrona |

## Setup passo a passo

### REUSABLE (criar 1 vez por conta Stripe)

#### 1. Criar conta Stripe
- 🔗 [Cadastro](https://dashboard.stripe.com/register)
- Não precisa preencher dados bancários para usar **test mode**
- Teste à vontade sem ativar a conta

#### 2. Pegar API Keys de TESTE
- 🔗 [Dashboard → Test API Keys](https://dashboard.stripe.com/test/apikeys)
- Ative o toggle "Test mode" no canto superior direito
- Copie:
  - **Publishable key** (`pk_test_...`) → cliente
  - **Secret key** (`sk_test_...`) → servidor

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### 3. Pegar API Keys de PRODUÇÃO
Após validar conta + dados bancários:
- 🔗 [Dashboard → API Keys (live)](https://dashboard.stripe.com/apikeys)
- Desative "Test mode"
- Copie `sk_live_...` e `pk_live_...`

```env
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### PER-APP (criar para cada novo projeto)

#### 4. Criar produto e Price ID
- 🔗 [Dashboard → Products](https://dashboard.stripe.com/test/products)
- "Add product" → preencha nome, descrição, preço
- Tipo: **Recurring** (subscription) ou **One time**
- Após salvar, copie o **Price ID** (`price_xxx`)

```env
STRIPE_AI_PRICE_ID=price_xxx
STRIPE_AI_ANNUAL_PRICE_ID=price_xxx
```

⚠️ **Sem o Price ID o checkout não funciona!**

#### 5. Configurar Webhook
- 🔗 [Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
- "Add endpoint" → URL pública do seu app
- URL: `https://seu-dominio.com/api/payments/stripe/webhook`
- Eventos a subscrever:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

#### 6. Copiar Webhook Secret
- Após criar o endpoint, clique nele
- Em "Signing secret" → "Reveal"
- Copie o valor `whsec_xxx`

```env
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### 7. (Dev local) Stripe CLI para webhooks
Para receber webhooks no localhost sem ngrok:

```bash
# Instalar Stripe CLI
brew install stripe/stripe-cli/stripe   # macOS
scoop install stripe                    # Windows
# Linux: https://stripe.com/docs/stripe-cli#install

# Login
stripe login

# Forward webhooks pro localhost
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

A CLI mostra o webhook secret temporário — use ele em `STRIPE_WEBHOOK_SECRET` durante dev.

## Cartões de teste

| Número | CVV | Validade | Resultado |
|--------|-----|----------|-----------|
| 4242 4242 4242 4242 | qualquer 3 | qualquer futura | ✅ Aprovado |
| 4000 0000 0000 0002 | qualquer | qualquer | ❌ Recusado |
| 4000 0025 0000 3155 | qualquer | qualquer | 🔐 Requer autenticação 3DS |
| 4000 0000 0000 9995 | qualquer | qualquer | ❌ Saldo insuficiente |
| 5555 5555 5555 4444 | qualquer | qualquer | ✅ Aprovado (Mastercard) |
| 3782 822463 10005 | 4 dígitos | qualquer | ✅ Aprovado (AmEx) |

Use qualquer **CEP/ZIP** e qualquer **data futura**.

## Variáveis de ambiente

| Var | Tipo | Onde |
|-----|------|------|
| `STRIPE_SECRET_KEY` | REUSABLE | Dashboard → API Keys |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | REUSABLE | Dashboard → API Keys |
| `STRIPE_AI_PRICE_ID` | PER-APP | Products → Price ID |
| `STRIPE_AI_ANNUAL_PRICE_ID` | PER-APP | Products → Price ID anual |
| `STRIPE_WEBHOOK_SECRET` | PER-APP | Webhooks → Signing secret |

## Fluxo de pagamento

```
1. Client chama POST /api/payments/stripe/create { productId, customerEmail }
2. Backend cria PaymentIntent → retorna { clientSecret, orderId }
3. Client monta <Elements stripe={stripePromise} options={{clientSecret}}>
4. <PaymentElement /> renderiza form
5. Usuário preenche cartão e submete
6. stripe.confirmPayment() → Stripe processa
7. Stripe envia webhook → /api/payments/stripe/webhook
8. Backend marca order como PAID
```

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `400 Invalid API key` | `STRIPE_SECRET_KEY` errada ou não definida | Verifique env e modo (test vs live) |
| `No such price` | `STRIPE_AI_PRICE_ID` não existe ou é de outra conta | Confira Price ID no dashboard |
| Webhook não chega | URL não é pública / firewall | Use Stripe CLI em dev, ngrok ou deploy real |
| `Webhook signature verification failed` | `STRIPE_WEBHOOK_SECRET` errada | Recopie do dashboard ou regenere |
| Form não renderiza | `pk_publishable` errada ou rede bloqueando js.stripe.com | Inspecione console |

## Links

- [Dashboard Stripe](https://dashboard.stripe.com)
- [API Keys (test)](https://dashboard.stripe.com/test/apikeys)
- [Products](https://dashboard.stripe.com/test/products)
- [Webhooks](https://dashboard.stripe.com/test/webhooks)
- [Documentação de testes](https://stripe.com/docs/testing)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Docs Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Docs Stripe Elements](https://stripe.com/docs/payments/elements)
- [Pricing & Fees Brasil](https://stripe.com/br/pricing)
