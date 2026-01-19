# Configuração do Google Play In-App Purchases (IAP)

## 1. Criar App no Google Play Console

1. Acesse [play.google.com/console](https://play.google.com/console)
2. Crie um novo app ou use existente
3. Complete as informações básicas do app

## 2. Criar Produto de Assinatura

1. Vá em **Monetização > Produtos > Assinaturas**
2. Clique **Criar assinatura**
3. Configure:

### ID do Produto
```
seu_app_premium_monthly
```
⚠️ **IMPORTANTE:** Este ID DEVE ser EXATAMENTE igual ao definido no código:
```typescript
export const GOOGLE_PLAY_PRODUCT_ID = 'seu_app_premium_monthly';
```

### Detalhes do Produto
- **Nome:** Assinatura Premium
- **Descrição:** Acesso a todos os recursos premium

### Plano Base
1. Clique **Adicionar plano base**
2. Configure:
   - **ID do plano:** `monthly-plan`
   - **Período de cobrança:** 1 mês
   - **Preço:** R$ 9,99
   - **Período de avaliação:** (opcional) 7 dias

3. **Ativar** o plano base

## 3. Configurar Testadores de Licença

Para testar compras sem cobrança real:

1. Vá em **Configurações > Teste de licença**
2. Adicione emails dos testadores
3. Esses usuários verão preços de teste (ex: R$ 9,99/5min)

## 4. Configurar Service Account para Validação Server-Side

### No Google Cloud Console:

1. Vá em [console.cloud.google.com](https://console.cloud.google.com)
2. Selecione ou crie um projeto
3. Vá em **APIs e Serviços > Biblioteca**
4. Pesquise e ative: **Google Play Android Developer API**
5. Vá em **APIs e Serviços > Credenciais**
6. Clique **Criar credenciais > Conta de serviço**
7. Dê um nome (ex: `play-store-api`)
8. Após criar, clique na conta de serviço
9. Vá em **Chaves > Adicionar chave > Criar nova chave > JSON**
10. Baixe o arquivo JSON

### No Google Play Console:

1. Vá em **Configurações > Acesso à API**
2. Na seção "Contas de serviço", clique **Vincular conta de serviço**
3. Cole o email da service account (do Cloud Console)
4. Dê permissão de **Administrador de finanças** ou **Gerente de versões**

## 5. Implementação no App

### Plugin Tauri IAP

O plugin `tauri-plugin-iap` já está configurado. O fluxo é:

```typescript
import { initialize, getProducts, purchase, acknowledgePurchase } from '@choochmeque/tauri-plugin-iap-api';

// 1. Inicializar
await initialize();

// 2. Buscar produto
const { products } = await getProducts(['seu_app_premium_monthly'], 'subs');

// 3. Obter offerToken (necessário para assinaturas)
const offerToken = products[0].subscriptionOfferDetails[0].offerToken;

// 4. Iniciar compra
const result = await purchase('seu_app_premium_monthly', 'subs', { offerToken });

// 5. Acknowledge (obrigatório!)
await acknowledgePurchase(result.purchaseToken);

// 6. Validar no servidor
await fetch('/api/iap/validate-google-play', {
    method: 'POST',
    body: JSON.stringify({
        productId: result.productId,
        purchaseToken: result.purchaseToken,
    }),
});
```

## 6. Validação Server-Side (Opcional mas Recomendado)

Para produção, você deve validar compras com a API do Google:

```typescript
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});

const androidPublisher = google.androidpublisher({ version: 'v3', auth });

const subscription = await androidPublisher.purchases.subscriptions.get({
    packageName: 'com.seuapp.id',
    subscriptionId: productId,
    token: purchaseToken,
});

// subscription.data contém:
// - expiryTimeMillis: quando expira
// - paymentState: 0 = pendente, 1 = pago
// - cancelReason: motivo do cancelamento
```

## 7. Estados de Compra

| purchaseState | Significado |
|---------------|-------------|
| 0 | Compra ativa/válida |
| 1 | Cancelada |
| 2 | Pendente |

## 8. Testar no Dispositivo

### Build de Debug
```bash
npx tauri android dev
```

### Build de Release (para testar IAP)
```bash
npx tauri android build
```

⚠️ IAP só funciona em builds assinados com a mesma keystore do Google Play.

## 9. Período de Teste

No modo de teste, os períodos são encurtados:

| Período Real | Período de Teste |
|--------------|------------------|
| 1 semana     | 5 minutos        |
| 1 mês        | 5 minutos        |
| 3 meses      | 10 minutos       |
| 6 meses      | 15 minutos       |
| 1 ano        | 30 minutos       |

## 10. Checklist de Lançamento

- [ ] Produto de assinatura criado e ativado
- [ ] ID do produto igual no código e no Play Console
- [ ] Plano base configurado e ativado
- [ ] Testadores de licença adicionados
- [ ] Service account configurada (para validação server-side)
- [ ] Testado em dispositivo real com conta de testador
- [ ] Fluxo de compra funcionando
- [ ] Fluxo de restauração funcionando
- [ ] Acknowledgement funcionando (senão Google reembolsa automaticamente)
