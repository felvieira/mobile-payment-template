#!/usr/bin/env bash
# Generate a fresh Android signing keystore for this app.
# DO NOT reuse keystores across apps — if leaked, all apps sharing the key are compromised.
set -euo pipefail
NAME="${1:-app-release}"
mkdir -p android-signing
keytool -genkeypair -v \
  -keystore "android-signing/${NAME}.keystore" \
  -alias "${NAME}" \
  -keyalg RSA -keysize 2048 -validity 10000
echo ""
echo "✅ Generated android-signing/${NAME}.keystore"
echo ""
echo "Next steps for CI:"
echo "  base64 -w0 android-signing/${NAME}.keystore > android-signing/keystore.base64"
echo "  Add contents of keystore.base64 to GitHub Secret: KEYSTORE_BASE64"
echo "  Add GitHub Secrets: KEYSTORE_PASSWORD, KEY_ALIAS (=${NAME}), KEY_PASSWORD"
