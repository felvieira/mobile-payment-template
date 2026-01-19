# Criação e Configuração do Keystore Android

O keystore é necessário para assinar o APK/AAB para publicação na Google Play Store.

## Criar Keystore

```bash
keytool -genkey -v -keystore release.keystore -alias app-key -keyalg RSA -keysize 2048 -validity 10000
```

Responda as perguntas:
- **Senha do keystore:** (guarde em local seguro)
- **Nome:** Seu nome
- **Organização:** Sua empresa
- **Cidade/Estado/País:** Suas informações

## Converter para Base64 (para CI/CD)

```bash
# macOS/Linux
base64 -i release.keystore > keystore.base64.txt

# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) > keystore.base64.txt
```

## Configurar no GitHub Secrets

1. Vá em **Settings > Secrets and variables > Actions**
2. Adicione os seguintes secrets:

| Secret | Valor |
|--------|-------|
| `KEYSTORE_BASE64` | Conteúdo do arquivo `keystore.base64.txt` |
| `KEY_ALIAS` | `app-key` (ou o alias que você usou) |
| `KEYSTORE_PASSWORD` | A senha que você definiu |

## Configurar Service Account do Google Play

1. Vá no **Google Cloud Console**
2. Crie um novo projeto ou use existente
3. Habilite a **Google Play Android Developer API**
4. Crie uma **Service Account** com permissões de editor
5. Baixe o JSON da service account
6. No **Google Play Console**, vá em **Configurações > Acesso à API**
7. Vincule a service account e dê permissão de "Release manager"
8. Adicione o JSON completo como secret `PLAY_STORE_SERVICE_ACCOUNT_JSON` no GitHub

## Estrutura Local (não commitar!)

```
android-signing/
├── release.keystore        # O keystore
├── keystore.properties     # Propriedades (não usar em produção)
```

### keystore.properties (apenas para desenvolvimento local)

```properties
KEYSTORE_PATH=android-signing/release.keystore
KEYSTORE_ALIAS=app-key
KEYSTORE_PASSWORD=suasenha
KEY_PASSWORD=suasenha
```

## .gitignore

```gitignore
# Android signing (NUNCA commitar!)
android-signing/
*.keystore
*.jks
keystore.properties
```

## Verificar Assinatura do APK

```bash
# Verificar se o APK está assinado corretamente
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose app-signed.apk

# Ver detalhes do certificado
keytool -printcert -jarfile app-signed.apk
```
