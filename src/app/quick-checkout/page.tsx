'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, CreditCard, QrCode, Loader2, Copy, Check, Zap } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface PixPayment {
  orderId: string
  pixId: string
  brCode: string
  brCodeBase64: string
  status: string
  expiresAt: string
}

type PaymentGateway = 'stripe' | 'mercadopago' | 'pix'

export default function QuickCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <QuickCheckoutContent />
    </Suspense>
  )
}

function QuickCheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Pre-fill from query params (e.g. /quick-checkout?amount=5000&description=Consultoria)
  const [amount, setAmount] = useState(searchParams.get('amount') || '')
  const [description, setDescription] = useState(searchParams.get('description') || '')
  const [customerEmail, setCustomerEmail] = useState(searchParams.get('email') || '')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerTaxId, setCustomerTaxId] = useState('')

  // Payment state
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null)
  const [pixStatus, setPixStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // PIX polling
  useEffect(() => {
    if (!pixPayment || pixStatus === 'PAID') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/pix/status?orderId=${pixPayment.orderId}`)
        const data = await res.json()
        setPixStatus(data.status)

        if (data.status === 'PAID') {
          router.push(`/success?provider=pix&orderId=${pixPayment.orderId}`)
        }
      } catch (err) {
        console.error('Erro ao verificar status PIX:', err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [pixPayment, pixStatus, router])

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  function getAmountInCents(): number {
    return Math.round(parseFloat(amount) * 100)
  }

  function isFormValid(): boolean {
    const cents = getAmountInCents()
    return !!(customerEmail && amount && description && cents > 0 && !isNaN(cents))
  }

  async function createQuickPayment(provider: string) {
    if (!isFormValid()) {
      setError('Preencha todos os campos obrigatórios')
      return
    }

    setProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/payments/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: getAmountInCents(),
          currency: 'BRL',
          description,
          customerEmail,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          customerTaxId: customerTaxId || undefined,
          paymentProvider: provider,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar pagamento')
        return
      }

      return data
    } catch (err) {
      setError('Erro ao processar pagamento')
      console.error(err)
      return null
    } finally {
      setProcessing(false)
    }
  }

  async function handleStripePayment() {
    const data = await createQuickPayment('STRIPE')
    if (data?.clientSecret) {
      setClientSecret(data.clientSecret)
      setSelectedGateway('stripe')
    }
  }

  async function handleMercadoPagoPayment() {
    const data = await createQuickPayment('MERCADOPAGO')
    if (data?.initPoint) {
      window.location.href = data.initPoint
    }
  }

  async function handlePixPayment() {
    const data = await createQuickPayment('ABACATEPAY')
    if (data?.brCode) {
      setPixPayment(data)
      setPixStatus(data.status)
      setSelectedGateway('pix')
    }
  }

  function copyPixCode() {
    if (pixPayment?.brCode) {
      navigator.clipboard.writeText(pixPayment.brCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function simulatePixPayment() {
    if (!pixPayment) return
    try {
      await fetch('/api/payments/pix/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixId: pixPayment.pixId }),
      })
    } catch (err) {
      console.error('Erro ao simular:', err)
    }
  }

  // Stripe checkout form
  if (selectedGateway === 'stripe' && clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-lg">
          <Button variant="ghost" className="mb-4" onClick={() => { setSelectedGateway(null); setClientSecret(null) }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Pagamento com Cartao</CardTitle>
              <CardDescription>{description} - {formatPrice(getAmountInCents())}</CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripeCheckoutForm amount={getAmountInCents()} />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // PIX checkout
  if (selectedGateway === 'pix' && pixPayment) {
    const isDevMode = process.env.NEXT_PUBLIC_ABACATEPAY_ENV === 'dev'

    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-lg">
          <Button variant="ghost" className="mb-4" onClick={() => { setSelectedGateway(null); setPixPayment(null) }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>Pagamento via PIX</CardTitle>
              <CardDescription>
                {description} - {formatPrice(getAmountInCents())}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <img
                  src={pixPayment.brCodeBase64}
                  alt="QR Code PIX"
                  className="w-64 h-64"
                />
              </div>

              <div className="text-center">
                <Badge variant={pixStatus === 'PAID' ? 'default' : 'secondary'}>
                  {pixStatus === 'PAID' ? 'Pago' : 'Aguardando pagamento...'}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>Codigo PIX (Copia e Cola)</Label>
                <div className="flex gap-2">
                  <Input value={pixPayment.brCode} readOnly className="font-mono text-xs" />
                  <Button variant="outline" onClick={copyPixCode}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-gray-500 text-center">
                Expira em: {new Date(pixPayment.expiresAt).toLocaleString('pt-BR')}
              </p>

              {isDevMode && (
                <Button variant="outline" className="w-full" onClick={simulatePixPayment}>
                  Simular Pagamento (DEV)
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Main form
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Payment details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Pagamento Rapido
              </CardTitle>
              <CardDescription>
                Informe o valor e descricao para gerar uma cobranca
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="amount">Valor (R$) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descricao *</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Consultoria, Produto X, Servico Y"
                  required
                />
              </div>

              {amount && parseFloat(amount) > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total</span>
                    <span className="text-2xl font-bold">
                      {formatPrice(getAmountInCents())}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Customer info and payment buttons */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefone (para PIX)</Label>
                <Input
                  id="phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="11999999999"
                />
              </div>
              <div>
                <Label htmlFor="taxId">CPF (para PIX)</Label>
                <Input
                  id="taxId"
                  value={customerTaxId}
                  onChange={(e) => setCustomerTaxId(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>

              <Separator />

              {error && (
                <div className="text-red-500 text-sm">{error}</div>
              )}

              <div className="space-y-3">
                <p className="font-medium">Forma de Pagamento</p>

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handleStripePayment}
                  disabled={processing || !isFormValid()}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Cartao de Credito (Stripe)
                  {processing && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                </Button>

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handleMercadoPagoPayment}
                  disabled={processing || !isFormValid()}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Cartao / Parcelado (Mercado Pago)
                  {processing && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                </Button>

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handlePixPayment}
                  disabled={processing || !isFormValid()}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  PIX
                  {processing && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Stripe Checkout Form Component
function StripeCheckoutForm({ amount }: { amount: number }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setLoading(true)
    setError(null)

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/success?provider=stripe`,
      },
    })

    if (submitError) {
      setError(submitError.message || 'Erro ao processar pagamento')
      setLoading(false)
    }
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <Button type="submit" className="w-full" disabled={!stripe || loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Pagar {formatPrice(amount)}
      </Button>
    </form>
  )
}
