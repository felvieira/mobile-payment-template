'use client'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { EnvBadge } from '../_components/EnvBadge'
import { TestCardsTable } from '../_components/TestCardsTable'
import { CheckoutProButton } from '@/components/payments/mercadopago/CheckoutProButton'
import { TransparentCardForm } from '@/components/payments/mercadopago/TransparentCardForm'
import { TransparentPixQR } from '@/components/payments/mercadopago/TransparentPixQR'
import { TransparentBoleto } from '@/components/payments/mercadopago/TransparentBoleto'

// Bricks need ssr: false — they use browser-only MP SDK
const BricksPayment = dynamic(
  () => import('@/components/payments/mercadopago/BricksPayment').then((m) => m.BricksPayment),
  { ssr: false }
)
const BricksCard = dynamic(
  () => import('@/components/payments/mercadopago/BricksCard').then((m) => m.BricksCard),
  { ssr: false }
)
const BricksStatus = dynamic(
  () => import('@/components/payments/mercadopago/BricksStatus').then((m) => m.BricksStatus),
  { ssr: false }
)
const BricksWallet = dynamic(
  () => import('@/components/payments/mercadopago/BricksWallet').then((m) => m.BricksWallet),
  { ssr: false }
)

interface Product {
  id: string
  name: string
  price: number
  currency: string
}

export default function MPSandboxPage() {
  const [env, setEnv] = useState<string>('qa')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [result, setResult] = useState<unknown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proEmail, setProEmail] = useState('test@test.com')
  const [bricksPreferenceId, setBricksPreferenceId] = useState('')
  const [bricksStatusPaymentId, setBricksStatusPaymentId] = useState('')

  const publicKey =
    process.env.NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ||
    ''

  useEffect(() => {
    fetch('/api/sandbox/config')
      .then((r) => r.json())
      .then((c) => setEnv(c.mercadopago?.env || 'qa'))
      .catch(console.error)

    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        const list: Product[] = Array.isArray(data) ? data : data.products ?? []
        setProducts(list)
        if (list[0]) setSelectedProduct(list[0].id)
      })
      .catch(console.error)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onSuccess(data: any) {
    setError(null)
    setResult(data)
  }
  function onError(err: string) {
    setResult(null)
    setError(err)
  }

  const selectedProductData = products.find((p) => p.id === selectedProduct)

  return (
    <div className="container max-w-5xl py-10 space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">MercadoPago Sandbox</h1>
        <EnvBadge env={env} />
      </div>

      {/* Product selector */}
      {products.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap">Produto para teste:</Label>
          <select
            className="border rounded-md p-2 text-sm flex-1 max-w-sm"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — R${(p.price / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Result / Error alerts */}
      {result !== null && (
        <div className="border border-green-200 bg-green-50 rounded-md p-3">
          <pre className="text-xs overflow-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="checkout-pro">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-2">
              <TabsTrigger value="checkout-pro" className="text-xs">Checkout Pro</TabsTrigger>
              <TabsTrigger value="transparent-card" className="text-xs">Cartão</TabsTrigger>
              <TabsTrigger value="transparent-pix" className="text-xs">PIX</TabsTrigger>
              <TabsTrigger value="transparent-boleto" className="text-xs">Boleto</TabsTrigger>
              <TabsTrigger value="bricks-payment" className="text-xs">Bricks Payment</TabsTrigger>
              <TabsTrigger value="bricks-card" className="text-xs">Bricks Card</TabsTrigger>
              <TabsTrigger value="bricks-status" className="text-xs">Bricks Status</TabsTrigger>
              <TabsTrigger value="bricks-wallet" className="text-xs">Bricks Wallet</TabsTrigger>
            </TabsList>

            <TabsContent value="checkout-pro">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Pro (redirect)</CardTitle>
                  <CardDescription>
                    Cria uma preferência via <code>/checkout/preferences</code> e redireciona para o domínio do MP.
                    Suporta todos os métodos da conta MP do comprador.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Email do comprador</Label>
                    <Input
                      value={proEmail}
                      onChange={(e) => setProEmail(e.target.value)}
                      placeholder="buyer@test.com"
                      className="mt-1"
                    />
                  </div>
                  <CheckoutProButton
                    productId={selectedProduct}
                    customerEmail={proEmail}
                    onError={onError}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Em QA, use o Buyer Test User (TESTUSER1533392031803184682 / sbEE8c3ikt) para simular pagamentos.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transparent-card">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Transparente — Cartão</CardTitle>
                  <CardDescription>
                    Formulário no seu domínio usando o MP CardForm SDK (iframes).
                    Envia token para <code>/api/payments/mercadopago/process-card</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedProductData && publicKey ? (
                    <TransparentCardForm
                      productId={selectedProduct}
                      publicKey={publicKey}
                      amount={selectedProductData.price / 100}
                      onSuccess={onSuccess}
                      onError={onError}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Selecione um produto e verifique NEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transparent-pix">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Transparente — PIX</CardTitle>
                  <CardDescription>
                    Gera QR Code PIX no seu domínio via <code>/api/payments/mercadopago/process-pix</code>.
                    Polling automático a cada 5s.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TransparentPixQR
                    productId={selectedProduct}
                    onSuccess={(orderId) => onSuccess({ orderId, status: 'approved' })}
                    onError={onError}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transparent-boleto">
              <Card>
                <CardHeader>
                  <CardTitle>Checkout Transparente — Boleto</CardTitle>
                  <CardDescription>
                    Gera boleto via <code>/api/payments/mercadopago/process-boleto</code>.
                    CPF obrigatório. Vence em 3 dias úteis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TransparentBoleto productId={selectedProduct} onError={onError} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-payment">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Payment Brick</CardTitle>
                  <CardDescription>
                    Widget unificado: cartão + PIX + boleto + conta MP.
                    Precisa de um <code>preferenceId</code> criado via Checkout Pro.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Preference ID (do Checkout Pro)</Label>
                    <Input
                      value={bricksPreferenceId}
                      onChange={(e) => setBricksPreferenceId(e.target.value)}
                      placeholder="Cole o preference ID aqui"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  {bricksPreferenceId && publicKey && selectedProductData ? (
                    <BricksPayment
                      publicKey={publicKey}
                      preferenceId={bricksPreferenceId}
                      amount={selectedProductData.price / 100}
                      onSubmit={async (param) => onSuccess(param)}
                      onError={onError}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Informe um preferenceId para renderizar o widget.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-card">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Card Payment Brick</CardTitle>
                  <CardDescription>
                    Widget de cartão gerenciado pelo MP. Mais simples que o CardForm manual.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {publicKey && selectedProductData ? (
                    <BricksCard
                      publicKey={publicKey}
                      amount={selectedProductData.price / 100}
                      onSubmit={async (data) => onSuccess(data)}
                      onError={onError}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Selecione um produto para renderizar.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-status">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Status Screen</CardTitle>
                  <CardDescription>
                    Tela de resultado gerenciada pelo MP. Informe o Payment ID para renderizar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Payment ID</Label>
                    <Input
                      value={bricksStatusPaymentId}
                      onChange={(e) => setBricksStatusPaymentId(e.target.value)}
                      placeholder="Ex: 123456789"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  {bricksStatusPaymentId && publicKey ? (
                    <BricksStatus
                      publicKey={publicKey}
                      paymentId={bricksStatusPaymentId}
                      onError={onError}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Informe um Payment ID para renderizar.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bricks-wallet">
              <Card>
                <CardHeader>
                  <CardTitle>Bricks — Wallet (Pagar com MP)</CardTitle>
                  <CardDescription>
                    Botão de login e pagamento pela conta MercadoPago.
                    Precisa de um <code>preferenceId</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Preference ID</Label>
                    <Input
                      value={bricksPreferenceId}
                      onChange={(e) => setBricksPreferenceId(e.target.value)}
                      placeholder="Cole o preference ID aqui"
                      className="mt-1 font-mono text-xs"
                    />
                  </div>
                  {bricksPreferenceId && publicKey ? (
                    <BricksWallet
                      publicKey={publicKey}
                      preferenceId={bricksPreferenceId}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">Informe um preferenceId para renderizar.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dados de teste</CardTitle>
            </CardHeader>
            <CardContent>
              <TestCardsTable />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Links úteis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                → Painel MP Developers
              </a>
              <a
                href="https://www.mercadopago.com.br/developers/pt/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                → Documentação oficial
              </a>
              <a
                href="https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                → Checkout Transparente docs
              </a>
              <a
                href="https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/landing"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-blue-600 hover:underline"
              >
                → Checkout Bricks docs
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
