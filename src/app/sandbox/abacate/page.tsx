'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'
import { EnvBadge } from '../_components/EnvBadge'
import { AbacatePixForm } from '@/components/payments/abacate/AbacatePixForm'

interface Product {
  id: string
  name: string
  price: number
  currency: string
}

export default function AbacateSandboxPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [abacateEnv, setAbacateEnv] = useState<string>('dev')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isDev = abacateEnv === 'dev'

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
      .then(c => setAbacateEnv(c.abacate?.env || 'dev'))
      .catch(console.error)
  }, [])

  function onSuccess(orderId: string) {
    setError(null)
    setResult(`✅ PIX confirmado! Order ID: ${orderId}`)
  }
  function onError(err: string) {
    setResult(null)
    setError(`❌ ${err}`)
  }

  return (
    <div className="container max-w-5xl py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sandbox"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Abacate PIX Sandbox</h1>
        <EnvBadge env={abacateEnv} />
        {isDev && <Badge variant="secondary" className="text-xs">Simulação disponível</Badge>}
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
          <Tabs defaultValue="pix">
            <TabsList className="mb-4">
              <TabsTrigger value="pix">PIX QR Code</TabsTrigger>
              <TabsTrigger value="info">Sobre o Abacate PIX</TabsTrigger>
            </TabsList>

            <TabsContent value="pix">
              <Card>
                <CardHeader>
                  <CardTitle>PIX via Abacate Pay</CardTitle>
                  <CardDescription>
                    Gera QR Code PIX no seu domínio via <code>/api/payments/pix/create</code>.
                    Polling automático a cada 3s.
                    {isDev && ' Em modo dev, use "Simular pagamento" para confirmar instantaneamente.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedProduct ? (
                    <AbacatePixForm
                      key={selectedProduct}
                      productId={selectedProduct}
                      onSuccess={onSuccess}
                      onError={onError}
                      showSimulateButton={isDev}
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
                  <CardTitle>Sobre a integração Abacate PIX</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Fluxo</h3>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Client chama <code>POST /api/payments/pix/create</code></li>
                      <li>Backend cria PIX via Abacate Pay API → retorna <code>brCode</code> + <code>brCodeBase64</code></li>
                      <li>Client exibe QR Code e inicia polling a cada 3s</li>
                      <li>Polling chama <code>GET /api/payments/pix/status?orderId=xxx</code></li>
                      <li>Webhook <code>/api/payments/pix/webhook</code> atualiza o pedido em tempo real</li>
                      <li>Em dev: <code>POST /api/payments/abacatepay/simulate</code> confirma instantaneamente</li>
                    </ol>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Variáveis necessárias</h3>
                    <ul className="space-y-1 font-mono text-xs">
                      <li>ABACATE_PAY_ENV=dev|prod</li>
                      <li>ABACATE_PAY_DEV_API_KEY (dev)</li>
                      <li>ABACATE_PAY_PROD_API_KEY (PER-APP)</li>
                      <li>ABACATE_PAY_WEBHOOK_SECRET (PER-APP)</li>
                    </ul>
                  </div>
                  <a href="https://docs.abacatepay.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Documentação Abacate Pay</a>
                  <a href="https://dash.abacatepay.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Dashboard Abacate Pay</a>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Como testar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">Ambiente dev (ABACATE_PAY_ENV=dev)</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Gere um QR Code com email</li>
                  <li>Clique em <strong>&quot;Simular pagamento&quot;</strong></li>
                  <li>Aguarde confirmação automática via polling</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-foreground">Ambiente prod (ABACATE_PAY_ENV=prod)</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Gere um QR Code real</li>
                  <li>Pague com qualquer app de banco</li>
                  <li>Webhook + polling confirmam em segundos</li>
                </ol>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Setup PER-APP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>✅ <strong>REUSABLE:</strong> ABACATE_PAY_DEV_API_KEY</p>
              <p>⚠️ <strong>PER-APP:</strong></p>
              <ul className="list-disc list-inside space-y-1 pl-1">
                <li>Criar app no dashboard</li>
                <li>Copiar ABACATE_PAY_PROD_API_KEY</li>
                <li>Configurar webhook → copiar ABACATE_PAY_WEBHOOK_SECRET</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
