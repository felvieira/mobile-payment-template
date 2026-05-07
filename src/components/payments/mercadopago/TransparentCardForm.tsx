'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface Props {
  productId: string
  publicKey: string
  amount: number // BRL decimal
  onSuccess?: (data: { orderId: string; paymentId: string | number; status: string }) => void
  onError?: (err: string) => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago: any
  }
}

export function TransparentCardForm({
  productId,
  publicKey,
  amount,
  onSuccess,
  onError,
}: Props) {
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cardFormRef = useRef<any>(null)

  useEffect(() => {
    if (!publicKey) return

    function initForm() {
      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
      cardFormRef.current = mp.cardForm({
        amount: String(amount),
        iframe: true,
        form: {
          id: 'mp-transparent-card-form',
          cardNumber: { id: 'mp-card-number', placeholder: 'Número do cartão' },
          expirationDate: { id: 'mp-expiration-date', placeholder: 'MM/YY' },
          securityCode: { id: 'mp-security-code', placeholder: 'CVV' },
          cardholderName: { id: 'mp-cardholder-name', placeholder: 'Nome no cartão' },
          issuer: { id: 'mp-issuer' },
          installments: { id: 'mp-installments' },
          identificationType: { id: 'mp-identification-type' },
          identificationNumber: { id: 'mp-identification-number', placeholder: 'CPF' },
          cardholderEmail: { id: 'mp-cardholder-email', placeholder: 'Email' },
        },
        callbacks: {
          onFormMounted: (err: unknown) => {
            if (!err) setSdkReady(true)
          },
          onSubmit: async (event: { preventDefault: () => void }) => {
            event.preventDefault()
            const {
              paymentMethodId,
              issuerId,
              cardholderEmail,
              token,
              installments,
              identificationNumber,
            } = cardFormRef.current.getCardFormData()
            await processPayment({
              token,
              installments,
              paymentMethodId,
              issuerId,
              customerEmail: cardholderEmail,
              customerTaxId: identificationNumber,
            })
          },
        },
      })
    }

    if (document.getElementById('mp-sdk-script')) {
      if (window.MercadoPago) initForm()
      return
    }

    const script = document.createElement('script')
    script.id = 'mp-sdk-script'
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = initForm
    document.head.appendChild(script)

    return () => {
      cardFormRef.current?.unmount?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey])

  async function processPayment(data: {
    token: string
    installments: number
    paymentMethodId: string
    issuerId?: string
    customerEmail: string
    customerTaxId: string
  }) {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/process-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, productId, customerName }),
      })
      const result = await res.json()
      if (res.ok) {
        onSuccess?.({
          orderId: result.orderId,
          paymentId: result.paymentId,
          status: result.status,
        })
      } else {
        onError?.(result.error || 'Pagamento recusado')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form id="mp-transparent-card-form" className="space-y-4">
      <div>
        <Label>Nome completo</Label>
        <Input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Seu nome"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Número do cartão</Label>
        <div id="mp-card-number" className="mt-1 h-10 rounded-md border border-input px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Validade</Label>
          <div id="mp-expiration-date" className="mt-1 h-10 rounded-md border border-input px-3 py-2" />
        </div>
        <div>
          <Label>CVV</Label>
          <div id="mp-security-code" className="mt-1 h-10 rounded-md border border-input px-3 py-2" />
        </div>
      </div>
      <div>
        <Label>Nome no cartão</Label>
        <div id="mp-cardholder-name" className="mt-1 h-10 rounded-md border border-input px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Tipo de documento</Label>
          <div id="mp-identification-type" className="mt-1 h-10 rounded-md border border-input" />
        </div>
        <div>
          <Label>CPF</Label>
          <div id="mp-identification-number" className="mt-1 h-10 rounded-md border border-input px-3 py-2" />
        </div>
      </div>
      <div>
        <Label>Parcelas</Label>
        <div id="mp-installments" className="mt-1 h-10 rounded-md border border-input" />
      </div>
      <div id="mp-issuer" className="hidden" />
      <div id="mp-cardholder-email" className="hidden" />
      <Button type="submit" disabled={loading || !sdkReady} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {sdkReady ? 'Pagar com cartão' : 'Carregando SDK...'}
      </Button>
    </form>
  )
}
