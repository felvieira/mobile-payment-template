// src/lib/payments/iap.ts
// Client-side wrapper for Google Play IAP via tauri-plugin-iap.
// Server validation lives at app/api/iap/validate-google-play/route.ts.
// @tauri-apps/api will be available after Block 3 installs it.

export async function purchaseSubscription(productId: string): Promise<{ purchaseToken: string }> {
  // Dynamic import avoids SSR crash when running in web mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { invoke } = await import('@tauri-apps/api/core' as any)
  return (invoke as (cmd: string, args: unknown) => Promise<{ purchaseToken: string }>)(
    'plugin:iap|purchase',
    { productId }
  )
}

export async function validateOnServer(
  purchaseToken: string,
  productId: string,
  userId: string,
  apiUrl: string,
  packageName: string,
): Promise<{ status: 'active' | 'expired'; expiresAt: string }> {
  const res = await fetch(`${apiUrl}/api/iap/validate-google-play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purchaseToken, productId, packageName, userId }),
  })
  if (!res.ok) throw new Error(`IAP validation failed: ${res.status}`)
  return res.json()
}
