import { SITE_URL } from "./config"

/**
 * Detecta se está rodando no Tauri (APK/Desktop)
 * Usa verificação direta do objeto __TAURI_INTERNALS__ que é injetado pelo Tauri
 */
export function isRunningInTauri(): boolean {
    if (typeof window === 'undefined') return false
    // Verificação mais confiável para Tauri v2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).__TAURI_INTERNALS__
}

/**
 * Retorna a URL base da API dependendo do ambiente
 * - No Tauri (APK): aponta para o servidor web em produção
 * - No Web: usa URLs relativas (mesmo domínio)
 */
export function getApiBaseUrl(): string {
    // Se estiver no Tauri, usar a URL do servidor configurada
    if (isRunningInTauri()) {
        return process.env.NEXT_PUBLIC_API_URL || SITE_URL
    }

    // No web, usar URLs relativas (mesmo servidor)
    return ''
}

/**
 * Cria URL completa para chamadas de API
 */
export function getApiUrl(path: string): string {
    const baseUrl = getApiBaseUrl()
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return `${baseUrl}${cleanPath}`
}
