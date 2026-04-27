import { APP_CONFIG } from '../../app.config'

const ABACATE_API_BASE = 'https://api.abacatepay.com'

function getAbacateApiKey(): string {
    const env = process.env.ABACATE_PAY_ENV || 'dev'
    const key = env === 'prod'
        ? process.env.ABACATE_PAY_PROD_API_KEY
        : process.env.ABACATE_PAY_DEV_API_KEY
    if (!key) throw new Error(`Abacate Pay API key not configured for env: ${env}`)
    return key
}

function getAbacateEnv(): 'dev' | 'prod' {
    return (process.env.ABACATE_PAY_ENV as 'dev' | 'prod') || 'dev'
}

export interface AbacatePixResponse {
    data: {
        id: string
        amount: number
        status: string
        brCode: string
        brCodeBase64: string
        expiresAt: string
        metadata: Record<string, unknown>
    }
    error: string | null
    success: boolean
}

export interface AbacateCheckResponse {
    data: {
        id: string
        status: string
        expiresAt: string
    }
    error: string | null
    success: boolean
}

/**
 * Create a PIX QR code payment via Abacate Pay (v2 transparent API)
 */
export async function createAbacatePixPayment(userId: string, userEmail?: string): Promise<AbacatePixResponse> {
    const apiKey = getAbacateApiKey()
    const amountCents = Math.round(APP_CONFIG.pricing.annual * 100) // 7990

    // v2 transparent endpoint — returns brCode directly (no redirect)
    const body = {
        method: 'PIX',
        data: {
            amount: amountCents,
            expiresIn: 3600, // 1 hour
            description: `${APP_CONFIG.name} - Plano Anual`,
            metadata: {
                userId,
                plan: 'annual',
                environment: getAbacateEnv(),
            },
        },
    }

    const res = await fetch(`${ABACATE_API_BASE}/v2/transparents/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error('[PIX] Abacate Pay v2 create error:', res.status, errorText)

        // Fallback to v1 if v2 fails (backwards compat with existing keys)
        console.log('[PIX] Falling back to v1 endpoint...')
        return createAbacatePixPaymentV1(userId, amountCents)
    }

    const data: AbacatePixResponse = await res.json()
    if (!data.data?.id) {
        throw new Error('Invalid Abacate Pay response: missing data.id')
    }

    return data
}

/** v1 fallback — same endpoint the PosterFlix project uses successfully */
async function createAbacatePixPaymentV1(userId: string, amountCents: number): Promise<AbacatePixResponse> {
    const apiKey = getAbacateApiKey()

    const body = {
        amount: amountCents,
        expiresIn: 3600,
        description: `${APP_CONFIG.name} - Plano Anual`,
        metadata: {
            userId,
            plan: 'annual',
            environment: getAbacateEnv(),
        },
    }

    const res = await fetch(`${ABACATE_API_BASE}/v1/pixQrCode/create`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    })

    if (!res.ok) {
        const errorText = await res.text()
        console.error('[PIX] Abacate Pay v1 create error:', res.status, errorText)
        throw new Error(`Abacate Pay error: ${res.status}`)
    }

    const data: AbacatePixResponse = await res.json()
    if (!data.data?.id) {
        throw new Error('Invalid Abacate Pay response: missing data.id')
    }

    return data
}

/**
 * Check PIX payment status via Abacate Pay
 * Tries v2 first, falls back to v1
 */
export async function checkAbacatePixStatus(abacatePaymentId: string): Promise<AbacateCheckResponse> {
    const apiKey = getAbacateApiKey()
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    }

    // Try v2 first
    let res = await fetch(`${ABACATE_API_BASE}/v2/transparents/check?id=${abacatePaymentId}`, {
        method: 'GET',
        headers,
    })

    // Fallback to v1
    if (!res.ok) {
        res = await fetch(`${ABACATE_API_BASE}/v1/pixQrCode/check?id=${abacatePaymentId}`, {
            method: 'GET',
            headers,
        })
    }

    if (!res.ok) {
        const errorText = await res.text()
        console.error('[PIX] Abacate Pay check error:', res.status, errorText)
        throw new Error(`Abacate Pay check error: ${res.status}`)
    }

    return res.json()
}

import type { PaymentAdapter, CheckoutInput, CheckoutResult } from './types'

export const abacateAdapter: PaymentAdapter = {
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const res = await createAbacatePixPayment(input.userId, input.customerEmail)
    if (!res.success) throw new Error(res.error || 'Abacate PIX failed')
    return {
      brCode: res.data.brCode,
      brCodeBase64: res.data.brCodeBase64,
      providerSubId: res.data.id,
      expiresAt: new Date(res.data.expiresAt),
    }
  },
  async verifyWebhook(_req) {
    throw new Error('verifyWebhook not implemented in adapter — handled in route')
  },
  async getStatus(providerSubId) {
    const r = await checkAbacatePixStatus(providerSubId)
    return { status: r.data.status === 'PAID' ? 'active' : 'expired' }
  },
}
