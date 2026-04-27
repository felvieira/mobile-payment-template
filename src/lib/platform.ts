// src/lib/platform.ts
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export async function getPlatform(): Promise<'web' | 'android' | 'ios' | 'desktop'> {
  if (!isTauri()) return 'web'
  const { type } = await import('@tauri-apps/plugin-os')
  const t = await type()
  if (t === 'android') return 'android'
  if (t === 'ios') return 'ios'
  return 'desktop'
}
