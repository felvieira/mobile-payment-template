'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { EnvBadge } from '../_components/EnvBadge'
import { StripeTestCardsTable } from '../_components/StripeTestCardsTable'
import { StripeElementsForm } from '@/components/payments/stripe/StripeElementsForm'

interface Product {
  id: string
  name: string
  price: number
  currency: string
}

export default function StripeSandboxPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [email, setEmail] = useState('test@example.com')
  const [name, setName] = useState('Test User')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stripeEnv, setStripeEnv] = useState<string>('test')

  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => {
        const list: Product[] = Array.isArray(data) ? data : data.products ?? []
        setProducts(list)
        if (list[0]) setSelectedProduct(list[0].id)
      })
      .catch(console.error)

    fetch('/api/sandbox/config')
      .then(r => r.json())
      .then(c => setStripeEnv(c.stripe?.env || 'test'))
      .catch(console.error)
  }, [])

  function onSuccess(orderId: string) {
    setError(null)
    setResult(`✅ Pagamento aprovado! Order ID: ${orderId}`)
  }
  function onError(err: string) {
    setResult(null)
    setError(`❌ ${err}`)
  }

  const selectedProductData = products.find(p => p.id === selectedProduct)

  return (
    <div className="container max-w-5xl py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sandbox"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Stripe Sandbox</h1>
        <EnvBadge env={stripeEnv} />
      </div>

      {/* Product selector */}
      {products.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap">Produto:</Label>
          <select
            className="border rounded-md p-2 text-sm max-w-sm"
            value={selectedProduct}
            onChange={e => setSelectedProduct(e.target.value)}
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — R${(p.price / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Result / Error */}
      {result && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 text-green-800 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          {result}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
          <XCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="elements">
            <TabsList className="mb-4">
              <TabsTrigger value="elements">Payment Elements</TabsTrigger>
              <TabsTrigger value="info">Sobre o Stripe</TabsTrigger>
            </TabsList>

            <TabsContent value="elements">
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Payment Elements</CardTitle>
                  <CardDescription>
                    Formulário embutido no seu domínio via Stripe.js. Cria um PaymentIntent
                    via <code>/api/payments/stripe/create</code> e confirma no client.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Email *</Label>
                      <Input
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="test@example.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Nome</Label>
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Nome completo"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {selectedProductData ? (
                    <StripeElementsForm
                      key={`${selectedProduct}-${email}`}
                      productId={selectedProduct}
                      customerEmail={email}
                      customerName={name}
                      onSuccess={onSuccess}
                      onError={onError}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Selecione um produto acima.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>Sobre a integração Stripe</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Fluxo</h3>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Client chama <code>POST /api/payments/stripe/create</code></li>
                      <li>Backend cria PaymentIntent → retorna <code>clientSecret</code></li>
                      <li>Client monta Stripe Elements com o <code>clientSecret</code></li>
                      <li>Usuário preenche cartão e confirma</li>
                      <li>Stripe confirma e redireciona (ou resolve in-place)</li>
                      <li>Webhook <code>/api/payments/stripe/webhook</code> atualiza o pedido</li>
                    </ol>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Variáveis necessárias</h3>
                    <ul className="space-y-1 font-mono text-xs">
                      <li>STRIPE_SECRET_KEY</li>
                      <li>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</li>
                      <li>STRIPE_WEBHOOK_SECRET (PER-APP)</li>
                      <li>STRIPE_AI_PRICE_ID (PER-APP)</li>
                    </ul>
                  </div>
                  <a href="https://stripe.com/docs/testing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Documentação de testes Stripe</a>
                  <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Dashboard Stripe</a>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cartões de teste</CardTitle>
            </CardHeader>
            <CardContent>
              <StripeTestCardsTable />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Setup PER-APP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>✅ <strong>REUSABLE:</strong> STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY</p>
              <p>⚠️ <strong>PER-APP:</strong></p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Criar produto → copiar Price ID</li>
                <li>Configurar webhook no dashboard</li>
                <li>Copiar STRIPE_WEBHOOK_SECRET</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
