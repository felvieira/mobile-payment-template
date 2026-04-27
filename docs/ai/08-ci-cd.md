# CI/CD — Android Release & Web Deploy

## Overview

Two separate pipelines:
- **Android release** — Docker build → signed APK/AAB → Google Play Console (triggered manually)
- **Web deploy** — Next.js build check on PRs + Coolify webhook deploy on push to `main`

---

## Android Release (`android-release.yml`)

### Trigger

```yaml
on:
  workflow_dispatch:
    inputs:
      track:
        description: 'Play Console track'
        default: 'internal'
        type: choice
        options: [internal, alpha, beta, production]
```

Manual-only. Never auto-triggered on push (avoids accidental Play Console submissions).

### Build flow

```
GitHub Actions runner
↓
docker build -f Dockerfile.android .   ← installs Android SDK + NDK + Rust + Bun inside image
↓
bun run build:tauri -- android build --apk --aab   ← static Next.js export → Tauri Rust compile → APK/AAB
↓
Sign with jarsigner (keystore from GitHub Secrets)
↓
Upload to Play Console via Fastlane supply   ← or direct API
```

The Docker image handles the entire Android toolchain, so runners don't need any pre-installed SDK.

### GitHub Secrets required

| Secret | Value |
|--------|-------|
| `KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias (set during keytool) |
| `KEY_PASSWORD` | key password |
| `GOOGLE_PLAY_JSON_KEY` | Play Console service account JSON (for Fastlane) |

### Generating the keystore (one-time per app)

```bash
# Run android-signing/generate-keystore.sh — fills in app-specific values
cd android-signing
./generate-keystore.sh
# Outputs: release.keystore
# Then encode:
base64 -w0 release.keystore | pbcopy   # macOS
# Paste as KEYSTORE_BASE64 secret in GitHub
```

**Never commit the keystore file.** `android-signing/*.keystore` is in `.gitignore`.

### Google Play service account (for automated upload)

1. Google Play Console → Setup → API access → Link Google Cloud project
2. Google Cloud Console → IAM → Service Accounts → Create
3. Grant **Release manager** role in Play Console
4. Create JSON key → paste as `GOOGLE_PLAY_JSON_KEY` secret

---

## Web Deploy (`deploy-web.yml`)

### PR checks

```yaml
on:
  pull_request:
    branches: [main]
```

Runs `npm run build` (SSR mode, without `NEXT_PUBLIC_TARGET=tauri`) to catch TypeScript/build errors before merge.

### Production deploy

```yaml
on:
  push:
    branches: [main]
```

Sends a webhook to Coolify, which pulls the latest `main` and rebuilds the Docker container.

### Migrations run automatically on every deploy

The production `Dockerfile` uses `docker-entrypoint.sh` as its `ENTRYPOINT`:

```sh
#!/bin/sh
set -e
echo "Running Prisma migrations..."
npx prisma migrate deploy   # applies any pending migrations, safe to run repeatedly
exec node server.js         # starts the Next.js server
```

`prisma migrate deploy` is idempotent — it only runs migrations that haven't been applied yet. It never rolls back or resets data. This means:
- **Zero manual steps** when you push a schema change: deploy → migrations run automatically → server starts.
- **Safe on re-deploy** of unchanged code: no pending migrations → exits instantly.

To add a migration: edit `prisma/schema.prisma` → run `npm run db:migrate` locally → commit the generated migration file → push. Coolify will apply it automatically on next deploy.

### Coolify setup

1. Coolify dashboard → New resource → Git repository
2. Set Dockerfile path: `Dockerfile` (uses the multi-stage prod image)
3. Enable webhook deploy → copy webhook URL
4. Add webhook URL as `COOLIFY_WEBHOOK_URL` GitHub secret
5. Set all production env vars in Coolify UI (see `.env.prod` template)

### Environment files

```
.env.local     # local development — git-tracked for team convenience (test keys only)
.env.prod      # production template — gitignored, paste values into Coolify manually
.env.example   # full reference — git-tracked, REUSABLE vs PER-APP columns
```

**Workflow for updating production env:**
1. Edit `.env.prod` locally with new values
2. Copy into Coolify → Environment Variables UI
3. Trigger redeploy (push to main or manual Coolify redeploy)

---

## Required GitHub Secrets summary

### Android pipeline
- `KEYSTORE_BASE64`
- `KEYSTORE_PASSWORD`
- `KEY_ALIAS`
- `KEY_PASSWORD`
- `GOOGLE_PLAY_JSON_KEY`

### Web pipeline
- `COOLIFY_WEBHOOK_URL`

### Optional (if building with production API keys in CI)
- `STRIPE_SECRET_KEY`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- etc. — only needed if running integration tests in CI

---

## Local Android build (without CI)

```bash
# One-time: install Android SDK, NDK, Rust target
rustup target add aarch64-linux-android

# Debug APK (for development — cannot test IAP)
npm run tauri:android:dev

# Release APK/AAB (requires signing config in src-tauri/gen/android/)
npm run build:tauri
cd src-tauri && cargo tauri android build --apk
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ANDROID_SDK_ROOT not set` | Docker image not used | Use `docker build -f Dockerfile.android .` |
| `Upload failed: 403` | Play Console service account lacks permissions | Re-grant Release Manager in Play Console |
| Coolify deploy not triggered | Webhook URL wrong or not saved | Verify `COOLIFY_WEBHOOK_URL` secret + Coolify webhook settings |
| Build fails on `bun run build` in CI | Missing env vars | Add required env vars to GitHub Actions env or Coolify |
| APK installs but crashes on launch | keystore mismatch (debug vs release) | Use the same keystore registered in Play Console |
