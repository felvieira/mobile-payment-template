# Configuração do Stripe

## 1. Criar Conta e Produto

1. Acesse [dashboard.stripe.com](https://dashboard.stripe.com)
2. Vá em **Products** > **Add product**
3. Configure:
   - **Name:** Assinatura Premium
   - **Pricing:** Recurring
   - **Amount:** R$ 9,99
   - **Billing period:** Monthly

4. Copie o **Price ID** (começa com `price_`)

## 2. Configurar Webhook

1. Vá em **Developers > Webhooks**
2. Clique **Add endpoint**
3. URL: `https://seuapp.com/api/stripe/webhook`
4. Selecione os eventos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`

5. Copie o **Webhook signing secret** (começa com `whsec_`)

## 3. Configurar Customer Portal

1. Vá em **Settings > Billing > Customer portal**
2. Ative as opções:
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to view invoice history

## 4. Variáveis de Ambiente

```env
# Chave secreta (NÃO a publishable key)
STRIPE_SECRET_KEY=sk_live_...

# ID do preço da assinatura
STRIPE_AI_PRICE_ID=price_...

# Secret do webhook
STRIPE_WEBHOOK_SECRET=whsec_...

# URL do site (para redirects)
NEXT_PUBLIC_SITE_URL=https://seuapp.com
```

## 5. Testar Localmente

### Instalar Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (scoop)
scoop install stripe
```

### Fazer login

```bash
stripe login
```

### Encaminhar webhooks para localhost

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copie o webhook secret que aparece e use como `STRIPE_WEBHOOK_SECRET` local.

### Testar pagamento

Use o cartão de teste: `4242 4242 4242 4242`

- Data: qualquer data futura
- CVC: qualquer 3 dígitos
- CEP: qualquer CEP válido

## 6. Fluxo de Pagamento

```
Frontend                    Backend                     Stripe
   |                           |                          |
   |-- POST /create-checkout -->|                          |
   |                           |-- Create Session -------->|
   |                           |<-- Session URL -----------|
   |<-- Redirect URL ----------|                          |
   |                           |                          |
   |-- User pays on Stripe ----------------------------------->|
   |                           |                          |
   |                           |<-- Webhook: completed ----|
   |                           |-- Update DB ------------->|
   |                           |                          |
   |<-- Redirect with ?subscription=success ---------------|
```

## 7. Gerenciamento de Assinatura

O Stripe Customer Portal permite que usuários:
- Cancelem a assinatura
- Atualizem método de pagamento
- Vejam histórico de faturas

Para abrir o portal:

```typescript
const response = await fetch('/api/stripe/portal', {
    method: 'POST',
});
const { url } = await response.json();
window.location.href = url;
```

## 8. Modo Teste vs Produção

- **Teste:** Use chaves que começam com `sk_test_`
- **Produção:** Use chaves que começam com `sk_live_`

Lembre-se de criar produtos e preços separados para teste e produção.
