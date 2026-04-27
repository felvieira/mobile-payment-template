# Notifications — Local (Tauri) and Push (FCM)

## Two types

| Type | Where it fires | Use case |
|------|---------------|----------|
| Local (Tauri) | On device, triggered by client JS | Instant feedback after purchase, reminders |
| Push (FCM) | From your server → Firebase → device | Server-driven: renewal alerts, expiry warnings |

---

## Local notifications (`src/lib/notifications/local.ts`)

Uses `tauri-plugin-notification`. Only works when running inside Tauri (Android/desktop), not in the browser.

```ts
// src/lib/notifications/local.ts
export async function notify(input: { title: string; body: string }): Promise<void> {
  const { sendNotification } = await import('@tauri-apps/plugin-notification')
  const ok = await ensurePermission()
  if (!ok) throw new Error('Notification permission denied')
  await sendNotification(input)
}
```

Usage pattern:
```ts
import { notify } from '@/lib/notifications/local'
import { isTauri } from '@/lib/platform'

if (isTauri()) {
  await notify({ title: 'Compra concluída', body: 'Premium ativado!' })
} else {
  // web fallback — toast, alert, etc.
}
```

**Always use dynamic imports** for Tauri plugins — they crash on SSR otherwise:
```ts
// WRONG
import { sendNotification } from '@tauri-apps/plugin-notification'

// CORRECT (already done in local.ts — don't change it)
const { sendNotification } = await import('@tauri-apps/plugin-notification')
```

**Android permission:** The plugin calls `requestPermission()` automatically before the first notification. On Android 13+, the OS will show a system dialog. After denial, `ensurePermission()` returns `false` — handle gracefully, don't crash.

---

## FCM Push notifications (`src/lib/notifications/push.ts`)

Uses `firebase-admin` SDK. Runs **server-side only** — never call this from client code.

```ts
// src/lib/notifications/push.ts
export async function sendPush(input: {
  deviceToken: string   // FCM registration token from the device
  title: string
  body: string
  data?: Record<string, string>  // custom key-value payload
}): Promise<string> {
  return getApp().messaging().send({
    token: input.deviceToken,
    notification: { title: input.title, body: input.body },
    data: input.data,
  })
}
```

### Server endpoint (`src/app/api/notifications/send/route.ts`)

```
POST /api/notifications/send
Authorization: Bearer <NOTIFICATIONS_ADMIN_TOKEN>
Content-Type: application/json

{
  "deviceToken": "fcm-registration-token-from-device",
  "title": "Assinatura vence amanhã",
  "body": "Renove para continuar usando.",
  "data": { "screen": "/paywall" }
}
```

The endpoint validates `Authorization: Bearer <NOTIFICATIONS_ADMIN_TOKEN>` before dispatching.

### Getting the device FCM token

The device needs to retrieve its FCM registration token using the Firebase SDK or Tauri Firebase plugin, then send it to your server (e.g., save in the `User` model as `fcmToken`). Once you have the token, use `sendPush` server-side.

Example flow:
1. User logs in → device calls FCM to get registration token
2. POST to `/api/users/fcm-token` with the token
3. Server saves token to `User.fcmToken` (add this field to schema)
4. Cron job or webhook calls `sendPush({ deviceToken: user.fcmToken, ... })`

### Env vars

```
FCM_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # Firebase project service account
NOTIFICATIONS_ADMIN_TOKEN=<random-string>                # gates /api/notifications/send
```

Get `FCM_SERVICE_ACCOUNT_JSON`: Firebase Console → your project → Project Settings → Service accounts → Generate new private key → paste full JSON.

---

## Testing

**Local notification (Android emulator):**
1. Run `npm run tauri:android:dev`
2. Navigate to `/status`
3. Tap "Testar notificação local"
4. Android notification appears in system tray

**Push notification (curl test):**
```bash
curl -X POST https://yourapp.com/api/notifications/send \
  -H "Authorization: Bearer $NOTIFICATIONS_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceToken":"<fcm-token>","title":"Teste","body":"Push funcionando"}'
```
