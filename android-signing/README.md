# Android Signing

This directory holds signing credentials for the Android release build.
**Never commit keystore files or passwords to version control.**

## Generating a new keystore

Run from the repo root:

```bash
bash android-signing/generate-keystore.sh app-release
```

This creates `android-signing/app-release.keystore`.

## Registering the keystore in GitHub CI

1. Encode the keystore as Base64:
   ```bash
   base64 -w0 android-signing/app-release.keystore > android-signing/keystore.base64
   ```

2. Add the following GitHub repository secrets:
   - `KEYSTORE_BASE64` — contents of `keystore.base64`
   - `KEYSTORE_PASSWORD` — the keystore password you set during generation
   - `KEY_ALIAS` — the alias used (default: `app-release`)
   - `KEY_PASSWORD` — the key password (usually same as `KEYSTORE_PASSWORD`)

3. Delete `android-signing/keystore.base64` after adding the secret.

## Important

- Each app must have its own unique keystore.
- Once an app is published to Google Play, the keystore **cannot be changed** without re-publishing under a new package name.
- Store a secure backup of the keystore file offline (e.g., password manager or encrypted cloud storage).

## .gitignore

The following files are excluded from git by `.gitignore`:

```
android-signing/*.keystore
android-signing/*.jks
android-signing/keystore.properties
android-signing/keystore.base64
```
