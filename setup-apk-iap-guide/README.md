# Guia de Setup: Tauri + Stripe + Google Play IAP + CI/CD

Este guia documenta toda a configuração necessária para criar um app Next.js com:
- **Tauri** para build de APK Android
- **Stripe** para pagamentos web
- **Google Play IAP** para pagamentos in-app no Android
- **GitHub Actions** para CI/CD automatizado
- **Deploy automatizado** com `npm run release`

---

## Índice

1. [Estrutura de Arquivos](#estrutura-de-arquivos)
2. [Configuração do Tauri](#configuração-do-tauri)
3. [Configuração do Stripe](#configuração-do-stripe)
4. [Configuração do Google Play IAP](#configuração-do-google-play-iap)
5. [Banco de Dados (Supabase)](#banco-de-dados-supabase)
6. [GitHub Actions CI/CD](#github-actions-cicd)
7. [Scripts de Release](#scripts-de-release)
8. [Variáveis de Ambiente](#variáveis-de-ambiente)
9. [Fluxo de Pagamento](#fluxo-de-pagamento)

---

## Estrutura de Arquivos

```
project/
├── src-tauri/                    # Código Rust do Tauri
│   ├── Cargo.toml               # Dependências Rust
│   ├── tauri.conf.json          # Configuração do Tauri
│   ├── capabilities/
│   │   └── default.json         # Permissões do app
│   └── src/
│       └── lib.rs               # Entry point Rust
│
├── app/
│   └── api/
│       ├── stripe/
│       │   ├── create-checkout-session/route.ts
│       │   ├── portal/route.ts
│       │   └── webhook/route.ts
│       └── iap/
│           └── validate-google-play/route.ts
│
├── lib/
│   ├── stripe.ts                # Client Stripe
│   ├── env.ts                   # Detecção Tauri/Web
│   └── hooks/
│       └── use-subscription.ts  # Hook unificado de assinatura
│
├── scripts/
│   ├── release.js               # Script de release interativo
│   ├── bump-version.js          # Incrementa versão
│   └── build-tauri.js           # Build para Tauri
│
├── .github/
│   └── workflows/
│       └── android-release.yml  # CI/CD para Android
│
├── supabase/
│   └── migrations/
│       └── 20250105_create_subscriptions.sql
│
├── next.config.mjs              # Config web (SSR)
├── next.config.tauri.mjs        # Config Tauri (static export)
├── Dockerfile.android           # Build Android via Docker
└── android-signing/             # Keystore (não commitado)
```

---

## Configuração do Tauri

### 1. Instalar dependências

```bash
npm install @tauri-apps/cli @tauri-apps/api
npm install @choochmeque/tauri-plugin-iap-api  # Plugin IAP
```

### 2. tauri.conf.json

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "SeuApp",
  "version": "1.0.0",
  "identifier": "com.seuapp.id",
  "build": {
    "frontendDist": "../out",
    "beforeBuildCommand": "npm run build:tauri"
  },
  "app": {
    "windows": [
      {
        "title": "SeuApp",
        "width": 800,
        "height": 600,
        "resizable": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "plugins": {
    "deepLink": {
      "mobile": {
        "scheme": "com.seuapp.id"
      }
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

### 3. Cargo.toml (dependências Rust)

```toml
[package]
name = "app"
version = "0.1.0"
edition = "2021"
rust-version = "1.77.2"

[lib]
name = "app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.5.3", features = [] }

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
log = "0.4"
tauri = { version = "2.9.5", features = ["devtools"] }
tauri-plugin-log = "2"
tauri-plugin-notification = "2"
tauri-plugin-shell = "2"
tauri-plugin-opener = "2"
tauri-plugin-deep-link = "2"
tauri-plugin-iap = "0.6"

[profile.release]
codegen-units = 1
lto = false
opt-level = "s"
strip = "debuginfo"
```

### 4. capabilities/default.json (permissões)

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "enables the default permissions",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "notification:default",
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify",
    "shell:allow-open",
    {
      "identifier": "opener:allow-open-url",
      "allow": [
        { "url": "https://*" },
        { "url": "http://*" }
      ]
    },
    "deep-link:default",
    "iap:default"
  ]
}
```

### 5. src/lib.rs (entry point Rust)

```rust
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_iap::init())
    .setup(|app| {
      #[cfg(debug_assertions)]
      {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
        if let Some(window) = app.get_webview_window("main") {
          window.open_devtools();
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

---

## Configuração do Stripe

### 1. lib/stripe.ts

```typescript
import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not defined');
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-12-15.clover',
            typescript: true,
        });
    }
    return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        const client = getStripeClient();
        const value = client[prop as keyof Stripe];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    },
});

export const AI_SUBSCRIPTION_PRICE_ID = process.env.STRIPE_AI_PRICE_ID!;

export const getURL = () => {
    let url =
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.NEXT_PUBLIC_VERCEL_URL ??
        'http://localhost:3000';
    url = url.includes('http') ? url : `https://${url}`;
    url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
    return url;
};
```

### 2. API Routes do Stripe

Ver arquivos completos em:
- `files/stripe-create-checkout-session.ts`
- `files/stripe-portal.ts`
- `files/stripe-webhook.ts`

---

## Configuração do Google Play IAP

### 1. No Google Play Console

1. Criar produto de assinatura
2. ID do produto: `seu_app_premium_monthly`
3. Criar plano base mensal

### 2. No código (use-subscription.ts)

```typescript
export const GOOGLE_PLAY_PRODUCT_ID = 'seu_app_premium_monthly';
```

### 3. API de validação

Ver arquivo completo em `files/validate-google-play.ts`

---

## Banco de Dados (Supabase)

### Migration: subscriptions table

```sql
-- Tabela de assinaturas
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'canceled', 'past_due', 'inactive', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    platform TEXT DEFAULT 'stripe',  -- 'stripe', 'google_play', 'apple'
    product_id TEXT,                  -- Google Play product ID
    purchase_token TEXT,              -- Google Play purchase token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- Índices
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

---

## GitHub Actions CI/CD

### .github/workflows/android-release.yml

```yaml
name: Android Release

on:
  workflow_dispatch:  # Manual trigger

permissions:
  contents: write

jobs:
  build-and-release:
    runs-on: ubuntu-latest

    steps:
      - name: Free disk space and add swap
        run: |
          # Remove large pre-installed packages
          sudo rm -rf /usr/share/dotnet
          sudo rm -rf /usr/local/lib/android
          sudo rm -rf /opt/ghc
          sudo rm -rf /opt/hostedtoolcache/CodeQL

          # Add swap for Rust compilation
          sudo fallocate -l 8G /swapfile
          sudo chmod 600 /swapfile
          sudo mkswap /swapfile
          sudo swapon /swapfile

      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Decode and save keystore
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
        run: |
          mkdir -p android-signing
          echo "$KEYSTORE_BASE64" | base64 -d > android-signing/release.keystore

      - name: Setup Android dockerignore
        run: cp .dockerignore.android .dockerignore

      - name: Build Docker image
        run: docker build -f Dockerfile.android -t app-android-builder .

      - name: Build Android app and extract artifacts
        run: |
          docker run --name app-build app-android-builder
          mkdir -p android-release
          docker cp "app-build:/app/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-signed.apk" android-release/
          docker cp "app-build:/app/src-tauri/gen/android/app/build/outputs/bundle/universalRelease/app-signed.aab" android-release/
          docker rm app-build

      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT_JSON }}
          packageName: com.seuapp.id
          releaseFiles: android-release/app-signed.aab
          track: production
          status: completed

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            android-release/app-signed.apk
            android-release/app-signed.aab
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Secrets necessários no GitHub

1. `KEYSTORE_BASE64` - Keystore em base64: `base64 -i release.keystore`
2. `KEY_ALIAS` - Alias da key no keystore
3. `KEYSTORE_PASSWORD` - Senha do keystore
4. `PLAY_STORE_SERVICE_ACCOUNT_JSON` - JSON da service account do Google Play

---

## Scripts de Release

### scripts/release.js

Script interativo que:
1. Lê versão atual do `tauri.conf.json`
2. Incrementa patch version automaticamente
3. Pergunta se quer commitar
4. Pergunta se quer fazer push
5. Cria tag e envia pro GitHub
6. GitHub Actions detecta a tag e faz o build

**Uso:**
```bash
npm run release
```

### scripts/bump-version.js

```bash
npm run version:patch  # 1.0.9 -> 1.0.10
npm run version:minor  # 1.0.9 -> 1.1.0
npm run version:major  # 1.0.9 -> 2.0.0
```

### package.json scripts

```json
{
  "scripts": {
    "build": "npm run prebuild && next build",
    "build:tauri": "node scripts/build-tauri.js",
    "release": "node scripts/release.js",
    "version:bump": "node scripts/bump-version.js",
    "version:patch": "node scripts/bump-version.js patch",
    "version:minor": "node scripts/bump-version.js minor",
    "version:major": "node scripts/bump-version.js major"
  }
}
```

---

## Variáveis de Ambiente

### .env.local (desenvolvimento)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_AI_PRICE_ID=price_...

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OpenAI (se usar IA)
OPENAI_API_KEY=sk-...
```

### .env.tauri (build Tauri)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://seuapp.com
```

---

## Fluxo de Pagamento

### Web (Stripe)

```
1. Usuário clica "Assinar"
2. Frontend chama POST /api/stripe/create-checkout-session
3. Backend cria session e retorna URL
4. Usuário é redirecionado pro Stripe Checkout
5. Após pagamento, Stripe envia webhook
6. Webhook atualiza tabela `subscriptions`
7. Usuário é redirecionado de volta com ?subscription=success
```

### Android (Google Play IAP)

```
1. Usuário clica "Assinar com Google Play"
2. Frontend usa plugin IAP: initialize() -> getProducts() -> purchase()
3. Google Play mostra modal de compra
4. Após compra, frontend recebe purchaseToken
5. Frontend chama POST /api/iap/validate-google-play
6. Backend valida e atualiza tabela `subscriptions`
7. Frontend atualiza estado local
```

### Hook Unificado (use-subscription.ts)

O hook `useSubscription()` abstrai a complexidade:

```typescript
const {
    hasSubscription,    // boolean
    status,             // 'active' | 'canceled' | etc
    platform,           // 'stripe' | 'google_play'
    subscribe,          // função unificada (detecta plataforma)
    purchaseGooglePlay, // compra específica Android
    createCheckoutSession, // compra específica Web
    openPortal,         // gerenciar assinatura Stripe
    restoreGooglePlayPurchases, // restaurar compras Android
} = useSubscription();
```

---

## Checklist de Implementação

- [ ] Configurar Tauri com plugins necessários
- [ ] Criar produto no Stripe Dashboard
- [ ] Configurar webhook do Stripe
- [ ] Criar produto no Google Play Console
- [ ] Criar service account no Google Cloud
- [ ] Gerar keystore para assinatura Android
- [ ] Configurar secrets no GitHub
- [ ] Criar migration do banco de dados
- [ ] Implementar API routes
- [ ] Implementar hook de assinatura
- [ ] Testar fluxo web completo
- [ ] Testar fluxo Android completo
- [ ] Configurar CI/CD

---

## Arquivos Completos

Os arquivos completos estão na pasta `files/`:

- `stripe-create-checkout-session.ts`
- `stripe-portal.ts`
- `stripe-webhook.ts`
- `validate-google-play.ts`
- `use-subscription.ts`
- `env.ts`
- `Dockerfile.android`
- `android-release.yml`
- `release.js`
- `bump-version.js`
- `build-tauri.js`
