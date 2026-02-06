# Assinaturas Recorrentes - Payment Hub

Guia de implementação de assinaturas recorrentes usando Stripe.

## Visão Geral

O Payment Hub agora suporta tanto:
- **Pagamentos únicos** (produtos)
- **Assinaturas recorrentes** (mensais/anuais)

## Setup

### 1. Criar Preços Recorrentes no Stripe

No Stripe Dashboard (https://dashboard.stripe.com/products):

1. Crie um produto
2. Adicione um preço **recorrente**:
   - Valor: R$ 29,90
   - Intervalo: Mensal (ou Anual)
   - Moeda: BRL
3. Copie o **Price ID** (ex: `price_1ABC...`)

### 2. Configurar Variáveis de Ambiente

```bash
# .env
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## APIs Disponíveis

### Criar Assinatura

```typescript
POST /api/subscriptions/create

Body:
{
  "priceId": "price_1ABC...",
  "customerEmail": "user@example.com",
  "customerName": "John Doe"
}

Response:
{
  "subscriptionId": "sub_...",
  "clientSecret": "pi_..._secret_...",
  "customerId": "cus_..."
}
```

### Cancelar Assinatura

```typescript
POST /api/subscriptions/cancel

Body:
{
  "subscriptionId": "sub_..."
}

Response:
{
  "success": true,
  "subscription": { ... }
}
```

### Portal do Cliente

```typescript
POST /api/subscriptions/portal

Body:
{
  "customerId": "cus_...",
  "returnUrl": "https://example.com/dashboard"
}

Response:
{
  "url": "https://billing.stripe.com/..."
}
```

## Exemplo de Uso

### Frontend - Criar Assinatura

```tsx
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default function SubscribePage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  async function handleSubscribe() {
    const res = await fetch('/api/subscriptions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId: 'price_1ABC...',
        customerEmail: 'user@example.com',
        customerName: 'John Doe',
      }),
    })

    const data = await res.json()
    setClientSecret(data.clientSecret)
  }

  if (clientSecret) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm />
      </Elements>
    )
  }

  return <button onClick={handleSubscribe}>Assinar</button>
}

function CheckoutForm() {
  const stripe = useStripe()
  const elements = useElements()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/success',
      },
    })

    if (error) {
      alert(error.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit">Assinar</button>
    </form>
  )
}
```

### Cancelar Assinatura

```tsx
async function handleCancel(subscriptionId: string) {
  const res = await fetch('/api/subscriptions/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId }),
  })

  if (res.ok) {
    alert('Assinatura cancelada!')
  }
}
```

### Abrir Portal

```tsx
async function handleOpenPortal(customerId: string) {
  const res = await fetch('/api/subscriptions/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      returnUrl: window.location.href,
    }),
  })

  const data = await res.json()
  window.location.href = data.url
}
```

## Webhooks

O webhook existente em `/api/payments/stripe/webhook` já processa eventos de assinatura:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Testes

### Cartões de Teste

| Número | Resultado |
|--------|-----------|
| 4242 4242 4242 4242 | ✅ Sucesso |
| 4000 0000 0000 9995 | ❌ Falha |

### Testar Localmente

```bash
# Terminal 1
npm run dev

# Terminal 2
stripe listen --forward-to localhost:3000/api/payments/stripe/webhook
```

## Cobrança Recorrente

O Stripe cobra automaticamente:
- **Mensal**: A cada 30 dias
- **Anual**: A cada 365 dias

Se o pagamento falhar:
1. Stripe retenta automaticamente 3-4 vezes
2. Envia email para o cliente
3. Se todas tentativas falharem, cancela a assinatura

## Recursos

- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Elements](https://stripe.com/docs/payments/elements)
- [Webhooks](https://stripe.com/docs/webhooks)
