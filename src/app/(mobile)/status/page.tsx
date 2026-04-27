'use client'

import { useEffect, useState } from 'react'
import { notify } from '@/lib/notifications/local'
import { isTauri } from '@/lib/platform'

interface Subscription {
  id: string
  provider: string
  status: string
  planId: string
  currentPeriodEnd: string | null
}

export default function StatusPage() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/subscriptions/me?userId=demo-user')
      .then(r => r.json())
      .then(data => { setSub(data.subscription); setLoading(false) })
  }, [])

  async function testNotification() {
    if (isTauri()) {
      await notify({ title: 'Teste', body: 'Notificação local funcionando!' })
    } else {
      alert('Notificações locais só funcionam no app Android.')
    }
  }

  if (loading) return <p>Carregando...</p>

  return (
    <main style={{ padding: 24 }}>
      <h1>Status da Assinatura</h1>
      {sub ? (
        <div>
          <p>Status: <strong>{sub.status}</strong></p>
          <p>Plano: {sub.planId}</p>
          <p>Provedor: {sub.provider}</p>
          {sub.currentPeriodEnd && <p>Válido até: {new Date(sub.currentPeriodEnd).toLocaleDateString('pt-BR')}</p>}
        </div>
      ) : (
        <p>Sem assinatura ativa. <a href="/paywall">Assinar agora</a></p>
      )}
      <hr style={{ margin: '24px 0' }} />
      <button onClick={testNotification}>Testar notificação local</button>
    </main>
  )
}
