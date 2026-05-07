'use client'
import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface CheckoutFormProps {
  clientSecret: string
  orderId: string
  onSuccess: (orderId: string) => void
  onError: (err: string) => void
}

function CheckoutForm({ clientSecret, orderId, onSuccess, onError }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    const baseUrl = window.location.origin

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${baseUrl}/success?orderId=${orderId}`,
      },
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message || 'Pagamento recusado')
      setLoading(false)
    } else {
      onSuccess(orderId)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={loading || !stripe} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Confirmar pagamento
      </Button>
    </form>
  )
}

interface Props {
  productId: string
  customerEmail: string
  customerName?: string
  onSuccess?: (orderId: string) => void
  onError?: (err: string) => void
}

export function StripeElementsForm({ productId, customerEmail, customerName, onSuccess, onError }: Props) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function initPayment() {
    if (!customerEmail) { onError?.('Email obrigatório'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/stripe/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, customerEmail, customerName }),
      })
      const data = await res.json()
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setOrderId(data.orderId)
      } else {
        onError?.(data.error || 'Erro ao iniciar pagamento Stripe')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  if (!clientSecret) {
    return (
      <Button onClick={initPayment} disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Iniciar pagamento com Stripe
      </Button>
    )
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret, locale: 'pt-BR' }}>
      <CheckoutForm
        clientSecret={clientSecret}
        orderId={orderId}
        onSuccess={onSuccess ?? (() => {})}
        onError={onError ?? (() => {})}
      />
    </Elements>
  )
}
