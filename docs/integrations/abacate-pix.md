# Abacate PIX Integration Guide

Abacate Pay é uma plataforma brasileira para receber pagamentos via PIX com SDK simples, modo dev (com simulação de pagamento) e fee competitivo. Suporta QR Code dinâmico, copia-cola e webhook em tempo real.

## Modos suportados

| Modo | Componente | Endpoint | Descrição |
|------|-----------|----------|-----------|
| PIX QR Code | `AbacatePixForm` | `POST /api/payments/pix/create` | Gera QR Code + brCode (copia-cola) |
| Status polling | — | `GET /api/payments/pix/status?orderId=xxx` | Verifica status (default: poll a cada 3s) |
| Webhook | — | `POST /api/payments/pix/webhook` | Confirmação assíncrona em tempo real |
| Simulação (dev) | botão na UI | `POST /api/payments/abacatepay/simulate` | Confirma pagamento instantaneamente em modo dev |

## Setup passo a passo

### REUSABLE (1 vez por conta Abacate)

#### 1. Criar conta no Abacate Pay
- 🔗 [Dashboard](https://dash.abacatepay.com)
- Cadastro com email + senha
- Modo dev disponível imediatamente (sem CNPJ)
- Para receber em produção precisa cadastro PJ + dados bancários

#### 2. Pegar API Key de DEV
- No painel, vá em **API & Webhooks** ou **Integrações**
- Copie a "Chave de Desenvolvimento" (`abc_dev_xxx`)

```env
ABACATE_PAY_DEV_API_KEY=abc_dev_xxx
```

⚡ **Modo dev permite simular pagamentos** sem PIX real → ideal para CI/CD e desenvolvimento.

#### 3. Pegar API Key de PROD
Após validação PJ:
- Copie a "Chave de Produção" (`abc_prod_xxx`)

```env
ABACATE_PAY_PROD_API_KEY=abc_prod_xxx
```

⚠️ **Cobranças em prod são REAIS.** Cuidado para não testar com prod key.

### PER-APP (cada projeto)

#### 4. Configurar Webhook
- 🔗 [Dashboard → Webhooks](https://dash.abacatepay.com)
- "Adicionar endpoint" → URL pública do seu app
- URL: `https://seu-dominio.com/api/payments/pix/webhook`
- Configure separadamente para **dev** e **prod** se for usar ambos
- Eventos a subscrever:
  - `pix.payment.received` (PIX confirmado pelo banco)
  - `pix.payment.expired` (PIX não foi pago e expirou)

#### 5. Copiar Webhook Secret
- Após criar o webhook, copie o **secret de assinatura**
- Use para validar HMAC SHA-256 nas requisições recebidas

```env
ABACATE_PAY_WEBHOOK_SECRET=xxx
```

#### 6. Definir ambiente ativo
```env
ABACATE_PAY_ENV=dev   # ← libera o botão "Simular pagamento"
ABACATE_PAY_ENV=prod  # ← cobranças reais
```

## Variáveis de ambiente

| Var | Tipo | Onde |
|-----|------|------|
| `ABACATE_PAY_DEV_API_KEY` | REUSABLE | Dashboard → Integrações |
| `ABACATE_PAY_PROD_API_KEY` | REUSABLE (1 vez por conta) | Dashboard → Integrações |
| `ABACATE_PAY_ENV` | PER-APP | `dev` \| `prod` |
| `ABACATE_PAY_WEBHOOK_SECRET` | PER-APP | Webhooks → Secret |

## Fluxo de pagamento

```
1. Client → POST /api/payments/pix/create { productId, customerEmail }
2. Backend → cria PIX via Abacate API → retorna { brCode, brCodeBase64, pixId, expiresAt }
3. Client → exibe QR Code (base64 PNG) + botão "Copiar código"
4. Client → polling: GET /api/payments/pix/status a cada 3s
5. Cliente paga via app de banco
6. Abacate → webhook /api/payments/pix/webhook → marca order PAID
7. Polling client detecta PAID → redirect /success
```

### Em modo dev:

```
... mesmo fluxo até o passo 4 ...
5. Click no botão "Simular pagamento" no sandbox
6. Backend → POST /api/payments/abacatepay/simulate { pixQrCodeId }
7. Abacate API confirma pagamento instantaneamente
8. Polling pega status PAID → redirect
```

## Como testar

### No sandbox (`/sandbox/abacate`)

1. Configure `.env.local` com `ABACATE_PAY_DEV_API_KEY` e `ABACATE_PAY_ENV=dev`
2. Acesse `http://localhost:3000/sandbox/abacate`
3. Selecione um produto, informe email
4. Clique em **"Gerar QR Code PIX"**
5. Em modo dev: clique em **"Simular pagamento"** → confirmação automática
6. Em modo prod: pague o QR Code com app de banco real

### Webhook em dev

Para receber webhook de dev no localhost, use ngrok:

```bash
# Inicie o app
npm run dev

# Em outro terminal, exponha o localhost:3000
ngrok http 3000
# Copie o URL https gerado (ex: https://abc123.ngrok.io)

# No dashboard Abacate, configure webhook como:
# https://abc123.ngrok.io/api/payments/pix/webhook
```

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `401 Unauthorized` | API key errada | Verifique `ABACATE_PAY_*_API_KEY` no env |
| `403 Simulação só disponível em dev` | Tentando simular em prod | Mude `ABACATE_PAY_ENV=dev` |
| QR Code não aparece | Falha no Abacate API ou key inválida | Veja o response no Network tab |
| Webhook não chega | URL não é pública / Abacate não consegue acessar | Use ngrok em dev, deploy em prod |
| Polling não confirma após simular | Webhook ainda não chegou | Aguarde 5-10s ou recarregue |
| `Customer.taxId` inválido | CPF/CNPJ malformatado | Use só dígitos (sem pontos/hífens) |

## Pricing

Consulte a página oficial — geralmente ~0.99% por transação PIX (vs 4-5% Stripe/MP). Tem free tier mensal generoso.

## Links

- [Dashboard Abacate Pay](https://dash.abacatepay.com)
- [Documentação oficial](https://docs.abacatepay.com)
- [API Reference](https://docs.abacatepay.com/api-reference)
- [Status page](https://status.abacatepay.com)
- [Suporte](mailto:contato@abacatepay.com)
