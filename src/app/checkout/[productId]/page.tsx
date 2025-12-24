'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, CreditCard, QrCode, Loader2, Copy, Check } from 'lucide-react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  imageUrl: string | null
}

interface PixPayment {
  orderId: string
  pixId: string
  brCode: string
  brCodeBase64: string
  status: string
  expiresAt: string
}

type PaymentMethod = 'stripe' | 'mercadopago' | 'pix'

export default function CheckoutPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)

  // Form state
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerTaxId, setCustomerTaxId] = useState('')

  // Stripe state
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // PIX state
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null)
  const [pixStatus, setPixStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Loading states
  const [processingPayment, setProcessingPayment] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [productId])

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
      } catch (error) {
        console.error('Erro ao verificar status PIX:', error)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [pixPayment, pixStatus, router])

  async function fetchProduct() {
    try {
      const res = await fetch(`/api/products/${productId}`)
      if (!res.ok) {
        router.push('/')
        return
      }
      const data = await res.json()
      setProduct(data)
    } catch (error) {
      console.error('Erro ao buscar produto:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  }

  async function handleStripePayment() {
    if (!customerEmail) return alert('Informe seu email')

    setProcessingPayment(true)
    try {
      const res = await fetch('/api/payments/stripe/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerEmail,
          customerName,
        }),
      })

      const data = await res.json()
      if (data.clientSecret) {
        setClientSecret(data.clientSecret)
        setPaymentMethod('stripe')
      } else {
        alert('Erro ao iniciar pagamento')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao processar pagamento')
    } finally {
      setProcessingPayment(false)
    }
  }

  async function handleMercadoPagoPayment() {
    if (!customerEmail) return alert('Informe seu email')

    setProcessingPayment(true)
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
        // Redireciona para o Mercado Pago
        window.location.href = data.initPoint
      } else {
        alert('Erro ao iniciar pagamento')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao processar pagamento')
    } finally {
      setProcessingPayment(false)
    }
  }

  async function handlePixPayment() {
    if (!customerEmail) return alert('Informe seu email')

    setProcessingPayment(true)
    try {
      const res = await fetch('/api/payments/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerEmail,
          customerName,
          customerPhone,
          customerTaxId,
        }),
      })

      const data = await res.json()
      if (data.brCode) {
        setPixPayment(data)
        setPixStatus(data.status)
        setPaymentMethod('pix')
      } else {
        alert('Erro ao gerar PIX')
      }
    } catch (error) {
      console.error('Erro:', error)
      alert('Erro ao processar pagamento')
    } finally {
      setProcessingPayment(false)
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
      alert('Pagamento simulado! Aguarde a confirmação...')
    } catch (error) {
      console.error('Erro ao simular:', error)
    }
  }

  function copyPixCode() {
    if (pixPayment?.brCode) {
      navigator.clipboard.writeText(pixPayment.brCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return null
  }

  // Stripe checkout form
  if (paymentMethod === 'stripe' && clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-lg">
          <Link href={`/checkout/${productId}`} onClick={() => setPaymentMethod(null)}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>

          <Card>
            <CardHeader>
              <CardTitle>Pagamento com Cartão</CardTitle>
              <CardDescription>{product.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <StripeCheckoutForm
                  amount={product.price}
                  currency={product.currency}
                />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // PIX checkout
  if (paymentMethod === 'pix' && pixPayment) {
    const isDevMode = process.env.NEXT_PUBLIC_ABACATEPAY_ENV === 'dev'

    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-lg">
          <Link href={`/checkout/${productId}`} onClick={() => setPaymentMethod(null)}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>Pagamento via PIX</CardTitle>
              <CardDescription>
                {product.name} - {formatPrice(product.price, product.currency)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* QR Code */}
              <div className="flex justify-center">
                <img
                  src={pixPayment.brCodeBase64}
                  alt="QR Code PIX"
                  className="w-64 h-64"
                />
              </div>

              {/* Status */}
              <div className="text-center">
                <Badge variant={pixStatus === 'PAID' ? 'default' : 'secondary'}>
                  {pixStatus === 'PAID' ? 'Pago' : 'Aguardando pagamento...'}
                </Badge>
              </div>

              {/* Copy code */}
              <div className="space-y-2">
                <Label>Código PIX (Copia e Cola)</Label>
                <div className="flex gap-2">
                  <Input
                    value={pixPayment.brCode}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" onClick={copyPixCode}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Expiration */}
              <p className="text-sm text-gray-500 text-center">
                Expira em: {new Date(pixPayment.expiresAt).toLocaleString('pt-BR')}
              </p>

              {/* Dev mode simulation */}
              {isDevMode && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={simulatePixPayment}
                >
                  🧪 Simular Pagamento (DEV)
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Payment method selection
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar à loja
          </Button>
        </Link>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Product summary */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}
              <h3 className="font-semibold text-lg">{product.name}</h3>
              {product.description && (
                <p className="text-gray-600 text-sm mt-1">{product.description}</p>
              )}
              <Separator className="my-4" />
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total</span>
                <span className="text-2xl font-bold">
                  {formatPrice(product.price, product.currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Customer info and payment */}
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

              <Separator className="my-4" />

              <div className="space-y-3">
                <p className="font-medium">Forma de Pagamento</p>

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handleStripePayment}
                  disabled={processingPayment}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Cartão de Crédito (Stripe)
                  {processingPayment && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                </Button>

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handleMercadoPagoPayment}
                  disabled={processingPayment}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Cartão / Parcelado (Mercado Pago)
                  {processingPayment && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
                </Button>

                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={handlePixPayment}
                  disabled={processingPayment}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  PIX
                  {processingPayment && <Loader2 className="w-4 h-4 ml-auto animate-spin" />}
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
function StripeCheckoutForm({ amount, currency }: { amount: number; currency: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
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

  function formatPrice(cents: number, curr: string) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: curr,
    }).format(cents / 100)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <Button type="submit" className="w-full" disabled={!stripe || loading}>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : null}
        Pagar {formatPrice(amount, currency)}
      </Button>
    </form>
  )
}
