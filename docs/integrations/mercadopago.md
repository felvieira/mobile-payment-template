# MercadoPago Integration Guide

## Modos suportados

| Modo | Componente | Endpoint | Redirect? |
|------|-----------|----------|-----------|
| Checkout Pro | `CheckoutProButton` | `POST /api/payments/mercadopago/create` | ✅ Sim |
| Transparente Cartão | `TransparentCardForm` | `POST /api/payments/mercadopago/process-card` | ❌ Não |
| Transparente PIX | `TransparentPixQR` | `POST /api/payments/mercadopago/process-pix` | ❌ Não |
| Transparente Boleto | `TransparentBoleto` | `POST /api/payments/mercadopago/process-boleto` | ❌ Não |
| Bricks Payment | `BricksPayment` | (MP gerencia internamente) | ❌ Não |
| Bricks Card | `BricksCard` | (MP gerencia internamente) | ❌ Não |
| Bricks Status | `BricksStatus` | (MP gerencia internamente) | ❌ Não |
| Bricks Wallet | `BricksWallet` | (MP gerencia internamente) | Opcional |

## Variáveis de ambiente

### REUSABLE (criar 1 vez, reutilizar em todos os apps da mesma conta)

| Var | Descrição |
|-----|-----------|
| `MERCADOPAGO_QA_ACCESS_TOKEN` | Access Token da conta de teste |
| `NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY` | Public Key da conta de teste |
| `MERCADOPAGO_PROD_ACCESS_TOKEN` | Access Token da conta produção |
| `NEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY` | Public Key da conta produção |

### PER-APP (criar para cada novo projeto)

- [ ] **Criar app** no painel: https://www.mercadopago.com.br/developers/panel/app
- [ ] **Configurar webhook URL**: `https://seu-dominio/api/payments/mercadopago/webhook`
- [ ] **Copiar `MERCADOPAGO_WEBHOOK_SECRET`**: Painel MP → Webhooks → Suas chaves secretas
- [ ] **Definir `MERCADOPAGO_ENV`**: `qa` para testes, `prod` para produção

## Trocar QA ↔ PROD

Mude apenas uma variável:
```env
MERCADOPAGO_ENV=prod   # para produção
MERCADOPAGO_ENV=qa     # para testes
```

## Sandbox

Acesse `/sandbox/mercadopago` para testar todos os 8 modos com dados reais de teste.

## Cartões de teste (QA)

| Bandeira | Número | CVV | Validade |
|----------|--------|-----|----------|
| Mastercard | 5031 4332 1540 6351 | 123 | 11/30 |
| Visa | 4235 6477 2802 5682 | 123 | 11/30 |
| American Express | 3753 651535 56885 | 1234 | 11/30 |
| Elo Débito | 5067 7667 8388 8311 | 123 | 11/30 |

## CPFs de teste

| CPF | Status | Resultado |
|-----|--------|-----------|
| 12345678909 | APRO | Pagamento aprovado |
| 12345678909 | OTHE | Recusado por erro geral |
| 12345678909 | CONT | Pagamento pendente |
| 12345678909 | CALL | Recusado com validação |
| 12345678909 | FUND | Saldo insuficiente |
| 12345678909 | SECU | CVV inválido |
| 12345678909 | EXPI | Validade inválida |
| 12345678909 | FORM | Erro no formulário |

## Usuários de teste

| Tipo | Usuário | Senha |
|------|---------|-------|
| Seller (sua conta) | TESTUSER8540916956785474261 | mkEI0Mg28y |
| Buyer (comprador) | TESTUSER1533392031803184682 | sbEE8c3ikt |

## Troubleshooting

- **`400 Invalid card token`**: SDK CardForm não inicializou — verifique `NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY`
- **`401 Unauthorized`**: Access token errado, expirado ou env errada (QA token em modo prod ou vice-versa)
- **Webhook não recebe**: Verifique se o URL está público e `MERCADOPAGO_WEBHOOK_SECRET` está configurado
- **PIX não gera QR**: Em sandbox QA, o PIX funciona mas o pagamento simulado precisa ser feito pelo painel MP
- **Bricks não renderiza**: Os componentes Bricks precisam de `ssr: false` no Next.js — use `dynamic()` import

## Links

- [Painel Developers MP](https://www.mercadopago.com.br/developers/panel/app)
- [Docs Checkout Transparente](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing)
- [Docs Checkout Bricks](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/landing)
- [Docs Checkout Pro](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing)
- [Referência de status de pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/response-handling/collection-results)
