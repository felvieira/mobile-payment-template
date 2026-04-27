'use client'

import { useEffect, useState } from 'react'
import { APP_CONFIG } from '../../../../app.config'
import { getPlatform } from '@/lib/platform'
import { purchaseSubscription, validateOnServer } from '@/lib/payments/iap'
import { notify } from '@/lib/notifications/local'

export default function Paywall() {
  const [plat, setPlat] = useState<'web' | 'android' | 'ios' | 'desktop'>('web')
  useEffect(() => { getPlatform().then(setPlat) }, [])

  const userId = 'demo-user' // TODO: replace with real userId from auth (Task 5.4)

  async function buyIap() {
    try {
      const { purchaseToken } = await purchaseSubscription(APP_CONFIG.iap.monthlyProductId)
      await validateOnServer(purchaseToken, APP_CONFIG.iap.monthlyProductId, userId, APP_CONFIG.productionUrl, APP_CONFIG.packageName)
      await notify({ title: 'Compra concluída', body: 'Premium ativado com sucesso!' })
    } catch (e) {
      alert(`Erro: ${e}`)
    }
  }

  async function buyStripe() {
    const r = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID || 'price_monthly' }),
    })
    const { redirectUrl } = await r.json()
    window.location.href = redirectUrl
  }

  async function buyMP() {
    const r = await fetch('/api/mercadopago/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planId: 'mp_monthly' }),
    })
    const { redirectUrl } = await r.json()
    window.location.href = redirectUrl
  }

  async function buyPix() {
    const r = await fetch('/api/pix/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, planId: 'annual' }),
    })
    const { brCode, brCodeBase64 } = await r.json()
    window.dispatchEvent(new CustomEvent('pix:show', { detail: { brCode, brCodeBase64 } }))
  }

  if (plat === 'android') {
    return (
      <main style={{ padding: 24 }}>
        <h1>{APP_CONFIG.name} Premium</h1>
        <p>R$ {APP_CONFIG.pricing.monthly.toFixed(2)} / mês</p>
        <button onClick={buyIap} style={{ fontSize: 18, padding: '12px 24px' }}>
          Assinar via Google Play
        </button>
      </main>
    )
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>{APP_CONFIG.name} Premium</h1>
      <p>Escolha a forma de pagamento:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
        <button onClick={buyStripe}>Cartão de crédito (Stripe)</button>
        <button onClick={buyMP}>MercadoPago</button>
        <button onClick={buyPix}>PIX — Anual R$ {APP_CONFIG.pricing.annual.toFixed(2)}</button>
      </div>
    </main>
  )
}
