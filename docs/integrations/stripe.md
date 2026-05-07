# Stripe Integration Guide

## Modos suportados

| Modo | Componente | Endpoint |
|------|-----------|----------|
| Payment Intent (Elements) | `StripeCheckout` | `POST /api/payments/stripe/create` |

## Variáveis de ambiente

### REUSABLE
- `STRIPE_SECRET_KEY` — chave secreta da conta
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — chave pública

### PER-APP
- [ ] Criar produto e copiar `STRIPE_AI_PRICE_ID`
- [ ] Criar produto anual e copiar `STRIPE_AI_ANNUAL_PRICE_ID`
- [ ] Configurar webhook: `https://seu-dominio/api/payments/stripe/webhook`
- [ ] Copiar `STRIPE_WEBHOOK_SECRET`

## Cartões de teste

| Número | Resultado |
|--------|-----------|
| 4242 4242 4242 4242 | Aprovado |
| 4000 0000 0000 0002 | Recusado |
| 4000 0025 0000 3155 | Requer 3DS |

## Links

- [Dashboard Stripe](https://dashboard.stripe.com)
- [Docs Testing](https://stripe.com/docs/testing)
