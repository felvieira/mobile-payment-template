'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { EnvBadge } from './_components/EnvBadge'

interface GatewayStatus {
  configured: boolean
  env: string
}

interface Config {
  mercadopago: GatewayStatus
  stripe: GatewayStatus
  abacate: GatewayStatus
  googlePlay: GatewayStatus
}

const GATEWAYS = [
  {
    key: 'mercadopago',
    name: 'MercadoPago',
    href: '/sandbox/mercadopago',
    modes: ['Checkout Pro', 'Cartão Transparente', 'PIX Transparente', 'Boleto', 'Bricks (4 widgets)'],
  },
  {
    key: 'stripe',
    name: 'Stripe',
    href: '/sandbox/stripe',
    modes: ['Payment Intent', 'Stripe Elements', 'Checkout Session'],
  },
  {
    key: 'abacate',
    name: 'Abacate PIX',
    href: '/sandbox/abacate',
    modes: ['PIX QR Code', 'PIX Copia-Cola', 'Simulação'],
  },
  {
    key: 'googlePlay',
    name: 'Google Play IAP',
    href: '/sandbox/google-play',
    modes: ['Validate Purchase', 'RTDN Webhook', 'Reconcile Cron', 'Tauri Plugin'],
  },
]

export default function SandboxPage() {
  const [config, setConfig] = useState<Config | null>(null)

  useEffect(() => {
    fetch('/api/sandbox/config')
      .then((r) => r.json())
      .then(setConfig)
      .catch(console.error)
  }, [])

  return (
    <div className="container max-w-3xl py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Hub — Sandbox</h1>
        <p className="text-muted-foreground mt-2">
          Teste todos os gateways de pagamento disponíveis neste template.
          Cada gateway tem uma página de sandbox com dados de teste, exemplos de payload e componentes funcionais.
        </p>
      </div>

      <div className="grid gap-4">
        {GATEWAYS.map((gw) => {
          const status = config?.[gw.key as keyof Config]
          return (
            <Card key={gw.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {status?.configured ? (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                    )}
                    {gw.name}
                  </CardTitle>
                  {status && <EnvBadge env={status.env} />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {gw.modes.map((m) => (
                    <Badge key={m} variant="secondary" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
                <Button
                  asChild
                  size="sm"
                  variant={status?.configured ? 'default' : 'outline'}
                >
                  <Link href={gw.href}>
                    {status?.configured ? 'Abrir sandbox' : 'Ver setup'}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Dica: configure as variáveis de ambiente em <code className="bg-muted px-1 rounded">.env.local</code> para ativar cada gateway.
        Veja <code className="bg-muted px-1 rounded">.env.example</code> para a lista completa.
      </p>
    </div>
  )
}
