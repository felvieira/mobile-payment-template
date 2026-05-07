'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface Props {
  productId: string
  customerEmail: string
  customerName?: string
  label?: string
  className?: string
  onError?: (err: string) => void
}

export function CheckoutProButton({
  productId,
  customerEmail,
  customerName,
  label = 'Pagar com Mercado Pago',
  className,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!customerEmail) {
      onError?.('Email obrigatório')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerEmail,
          customerName,
          installments: 12,
        }),
      })
      const data = await res.json()
      if (data.initPoint) {
        window.location.href = data.initPoint
      } else {
        onError?.(data.error || 'Erro ao criar preferência')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} className={className}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  )
}
