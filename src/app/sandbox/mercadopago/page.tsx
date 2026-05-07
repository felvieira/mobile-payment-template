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
import { SetupGuide } from '../_components/SetupGuide'

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
          <Tabs defaultValue="setup">
            <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-2">
              <TabsTrigger value="setup" className="text-xs">📘 Setup</TabsTrigger>
              <TabsTrigger value="checkout-pro" className="text-xs">Checkout Pro</TabsTrigger>
              <TabsTrigger value="transparent-card" className="text-xs">Cartão</TabsTrigger>
              <TabsTrigger value="transparent-pix" className="text-xs">PIX</TabsTrigger>
              <TabsTrigger value="transparent-boleto" className="text-xs">Boleto</TabsTrigger>
              <TabsTrigger value="bricks-payment" className="text-xs">Bricks Payment</TabsTrigger>
              <TabsTrigger value="bricks-card" className="text-xs">Bricks Card</TabsTrigger>
              <TabsTrigger value="bricks-status" className="text-xs">Bricks Status</TabsTrigger>
              <TabsTrigger value="bricks-wallet" className="text-xs">Bricks Wallet</TabsTrigger>
            </TabsList>

            <TabsContent value="setup">
              <Card>
                <CardHeader>
                  <CardTitle>Como configurar o MercadoPago</CardTitle>
                  <CardDescription>
                    Passo a passo completo: criar conta, app, pegar credenciais, configurar webhook.
                    Os passos REUSABLE você faz uma vez por conta MP. Os PER-APP precisam ser refeitos para cada projeto novo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SetupGuide
                    title="Setup MercadoPago — QA + PROD"
                    subtitle="Total: ~10 minutos para QA, ~15 minutos para PROD com webhook"
                    steps={[
                      {
                        num: 1,
                        title: 'Criar conta no Mercado Pago',
                        desc: 'Você precisa de uma conta MP normal (a mesma que usa pra receber dinheiro). Para testes, o MP cria uma conta QA paralela automaticamente.',
                        href: 'https://www.mercadopago.com.br/registration-mp',
                        type: 'reusable',
                      },
                      {
                        num: 2,
                        title: 'Acessar o painel de Developers',
                        desc: 'Após login, acesse o painel de aplicações. Aqui você cria suas integrações.',
                        href: 'https://www.mercadopago.com.br/developers/panel/app',
                        type: 'reusable',
                      },
                      {
                        num: 3,
                        title: 'Criar uma aplicação (App)',
                        desc: 'Clique em "Criar aplicação". Escolha "Pagamentos online" → "Checkout Transparente" (cobre todos os modos: Bricks, Checkout Pro e Transparente).',
                        href: 'https://www.mercadopago.com.br/developers/panel/app',
                        type: 'per-app',
                        bullets: [
                          'Nome do app: ex. "MeuProjeto"',
                          'Solução: Checkout Pro / Transparente',
                          'Modelo de integração: API Orders',
                        ],
                      },
                      {
                        num: 4,
                        title: 'Copiar credenciais de TESTE (QA)',
                        desc: 'Em "Credenciais de teste" copie o Public Key e o Access Token. Cole em .env.local nas vars MERCADOPAGO_QA_*.',
                        href: 'https://www.mercadopago.com.br/developers/panel/app',
                        type: 'reusable',
                        copy: 'MERCADOPAGO_QA_ACCESS_TOKEN=APP_USR-xxx\nNEXT_PUBLIC_MERCADOPAGO_QA_PUBLIC_KEY=APP_USR-xxx',
                      },
                      {
                        num: 5,
                        title: 'Copiar credenciais de PRODUÇÃO',
                        desc: 'Em "Credenciais de produção" copie o Public Key e o Access Token. Cole em .env.prod.local nas vars MERCADOPAGO_PROD_*.',
                        href: 'https://www.mercadopago.com.br/developers/panel/app',
                        type: 'reusable',
                        copy: 'MERCADOPAGO_PROD_ACCESS_TOKEN=APP_USR-xxx\nNEXT_PUBLIC_MERCADOPAGO_PROD_PUBLIC_KEY=APP_USR-xxx',
                      },
                      {
                        num: 6,
                        title: 'Criar Usuários de Teste',
                        desc: 'Para testar Checkout Pro/Bricks você precisa de um Buyer Test User (não pode usar sua própria conta MP em modo teste).',
                        href: 'https://www.mercadopago.com.br/developers/panel/test-users',
                        type: 'reusable',
                        bullets: [
                          'Crie 1 Seller Test User (você como vendedor)',
                          'Crie 1 Buyer Test User (comprador para testar pagamentos)',
                          'Anote usuário, senha e código de verificação',
                        ],
                      },
                      {
                        num: 7,
                        title: 'Configurar Webhook (URL pública)',
                        desc: 'No app criado, vá em "Webhooks" → "Configurar notificações". URL deve ser pública (não localhost). Use ngrok ou deploy de teste.',
                        href: 'https://www.mercadopago.com.br/developers/panel/app',
                        type: 'per-app',
                        copy: 'https://seu-dominio.com/api/payments/mercadopago/webhook',
                        bullets: [
                          'Eventos a marcar: Payment, Plan, Subscription',
                          'Modo: Produção (ou Teste, conforme suas keys)',
                        ],
                      },
                      {
                        num: 8,
                        title: 'Copiar Webhook Secret',
                        desc: 'Após salvar o webhook, em "Suas chaves secretas" copie a secret. Cole em MERCADOPAGO_WEBHOOK_SECRET (vale para QA e PROD).',
                        type: 'per-app',
                        copy: 'MERCADOPAGO_WEBHOOK_SECRET=xxx',
                      },
                      {
                        num: 9,
                        title: 'Definir ambiente ativo',
                        desc: 'No .env, MERCADOPAGO_ENV=qa usa as keys QA, MERCADOPAGO_ENV=prod usa as PROD. Trocar é só mudar essa var.',
                        type: 'per-app',
                        copy: 'MERCADOPAGO_ENV=qa',
                      },
                      {
                        num: 10,
                        title: 'Testar no sandbox',
                        desc: 'Volte aqui no /sandbox/mercadopago, escolha um produto e teste cada um dos 8 modos. Use os cartões de teste da sidebar.',
                        type: 'per-app',
                      },
                    ]}
                    links={[
                      { label: 'Painel Developers', href: 'https://www.mercadopago.com.br/developers/panel/app' },
                      { label: 'Test Users', href: 'https://www.mercadopago.com.br/developers/panel/test-users' },
                      { label: 'Docs Checkout Pro', href: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/landing' },
                      { label: 'Docs Checkout Transparente', href: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing' },
                      { label: 'Docs Bricks', href: 'https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/landing' },
                      { label: 'Docs Webhooks', href: 'https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks' },
                    ]}
                  />
                </CardContent>
              </Card>
            </TabsContent>

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
