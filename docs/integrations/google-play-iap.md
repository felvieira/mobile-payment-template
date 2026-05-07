# Google Play IAP Integration Guide

> ⚠️ **Tauri only** — IAP não funciona no browser. Requer APK gerado com Tauri.

## Endpoints

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/iap/validate-google-play` | Valida purchase token via Google Play Developer API |
| `POST /api/iap/google-play-rtdn` | Webhook RTDN do Pub/Sub (notificações em tempo real) |
| `POST /api/cron/reconcile-google-play` | Reconciliação diária de assinaturas |

## Variáveis de ambiente

Todas são PER-APP (específicas por package name):

| Var | Descrição |
|-----|-----------|
| `GOOGLE_PLAY_PACKAGE_NAME` | Package name do app (ex: `com.meuapp.demo`) |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | JSON da Service Account (inline, não caminho de arquivo) |
| `RTDN_WEBHOOK_SECRET` | Secret para autenticar Pub/Sub |
| `NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID` | Product ID da assinatura mensal |
| `NEXT_PUBLIC_GOOGLE_PLAY_ANNUAL_PRODUCT_ID` | Product ID da assinatura anual |

## Setup passo a passo

### 1. Google Play Console
- [ ] Crie o app no Google Play Console
- [ ] Em **Monetização → Assinaturas**, crie dois produtos:
  - `app_premium_monthly` (ou o nome que definir em `NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID`)
  - `app_premium_annual`

### 2. Google Cloud — Service Account
- [ ] Acesse Google Play Console → **Setup → API access**
- [ ] Conecte ou crie um projeto no Google Cloud
- [ ] Crie uma Service Account com papel **Visualizador**
- [ ] Gere uma chave JSON e cole o conteúdo em `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- [ ] No Play Console, conceda permissão de **Visualizar informações financeiras** à service account

### 3. RTDN via Pub/Sub
- [ ] No Google Cloud, crie um tópico Pub/Sub (ex: `google-play-rtdn`)
- [ ] No Play Console → **Monetização → Notificações em tempo real**, configure o tópico
- [ ] Crie uma assinatura Push no tópico apontando para:
  ```
  https://seu-dominio/api/iap/google-play-rtdn?secret=SEU_RTDN_WEBHOOK_SECRET
  ```
- [ ] Teste enviando uma notificação de teste pelo console

### 4. Tauri — cliente IAP
No app Tauri, use o plugin `tauri-plugin-purchase` para iniciar compras. Após a compra:
```typescript
// Após compra bem-sucedida no Tauri
await fetch('/api/iap/validate-google-play', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'app_premium_monthly',
    purchaseToken: purchase.purchaseToken,
    autoRenewing: purchase.autoRenewing,
  }),
})
```

## Cron de reconciliação

Configure um job diário para sync de estado:
```bash
curl -X POST https://seu-dominio/api/cron/reconcile-google-play \
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

## Troubleshooting

- **`Service account not configured`**: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` não está definida ou é inválida
- **`Invalid product ID`**: O `productId` enviado não está em `VALID_GOOGLE_PLAY_PRODUCT_IDS`
- **RTDN não chega**: Verifique se o tópico Pub/Sub está configurado e o secret está correto
- **`410 Subscription not found`**: Token inválido ou já consumido

## Links

- [Google Play Billing docs](https://developer.android.com/google/play/billing)
- [RTDN Reference](https://developer.android.com/google/play/billing/rtdn-reference)
- [Play Console](https://play.google.com/console)
