// src/lib/notifications/local.ts
// Tauri local notification wrapper. Only call on Android/desktop (not web).

export async function ensurePermission(): Promise<boolean> {
  const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')
  if (await isPermissionGranted()) return true
  const result = await requestPermission()
  return result === 'granted'
}

export async function notify(input: { title: string; body: string }): Promise<void> {
  const { sendNotification } = await import('@tauri-apps/plugin-notification')
  const ok = await ensurePermission()
  if (!ok) throw new Error('Notification permission denied')
  await sendNotification(input)
}
