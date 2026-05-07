'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, AlertCircle, ArrowRight, BookOpen, ExternalLink } from 'lucide-react'
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
    docsHref: 'https://github.com/felvieira/mobile-payment-template/blob/main/docs/integrations/mercadopago.md',
    dashboardHref: 'https://www.mercadopago.com.br/developers/panel/app',
    modes: ['Checkout Pro', 'Cartão Transparente', 'PIX Transparente', 'Boleto', 'Bricks (4 widgets)'],
    description: 'Gateway brasileiro com suporte a Checkout Pro (redirect), Transparente (cartão/PIX/boleto) e Bricks. Multi-env QA/PROD.',
  },
  {
    key: 'stripe',
    name: 'Stripe',
    href: '/sandbox/stripe',
    docsHref: 'https://github.com/felvieira/mobile-payment-template/blob/main/docs/integrations/stripe.md',
    dashboardHref: 'https://dashboard.stripe.com',
    modes: ['Payment Intent', 'Stripe Elements'],
    description: 'Gateway internacional com Payment Elements. Test mode imediato, suporta cartões globais e subscriptions.',
  },
  {
    key: 'abacate',
    name: 'Abacate PIX',
    href: '/sandbox/abacate',
    docsHref: 'https://github.com/felvieira/mobile-payment-template/blob/main/docs/integrations/abacate-pix.md',
    dashboardHref: 'https://dash.abacatepay.com',
    modes: ['PIX QR Code', 'PIX Copia-Cola', 'Simulação'],
    description: 'Gateway brasileiro especializado em PIX. Modo dev tem botão de simular pagamento — ótimo pra testar fluxo completo.',
  },
  {
    key: 'googlePlay',
    name: 'Google Play IAP',
    href: '/sandbox/google-play',
    docsHref: 'https://github.com/felvieira/mobile-payment-template/blob/main/docs/integrations/google-play-iap.md',
    dashboardHref: 'https://play.google.com/console',
    modes: ['Validate Purchase', 'RTDN Webhook', 'Reconcile Cron', 'Tauri Plugin'],
    description: 'In-App Purchase para apps Android (Tauri APK). Inclui validator, RTDN via Pub/Sub e cron de reconciliação.',
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
          Cada gateway tem uma página de sandbox com dados de teste, componentes funcionais
          e <strong>aba "📘 Setup" com passo a passo completo de como criar conta, pegar credenciais e configurar webhook</strong>.
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
                <p className="text-sm text-muted-foreground">{gw.description}</p>
                <div className="flex flex-wrap gap-1">
                  {gw.modes.map((m) => (
                    <Badge key={m} variant="secondary" className="text-xs">
                      {m}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
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
                  <Button asChild size="sm" variant="ghost">
                    <a href={gw.docsHref} target="_blank" rel="noopener noreferrer">
                      <BookOpen className="mr-1 h-4 w-4" />
                      Docs
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href={gw.dashboardHref} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1 h-4 w-4" />
                      Painel
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Documentação completa
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Cada gateway tem um guia detalhado em <code className="bg-muted px-1 rounded">docs/integrations/</code> com:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            <li>Setup passo a passo (criar conta, API keys, webhook, etc.)</li>
            <li>Variáveis REUSABLE vs PER-APP — o que reaproveitar entre projetos</li>
            <li>Cartões e dados de teste oficiais</li>
            <li>Troubleshooting dos erros mais comuns</li>
            <li>Links diretos pros painéis de cada serviço</li>
          </ul>
          <p className="pt-1">
            Configure as variáveis em <code className="bg-muted px-1 rounded">.env.local</code> (QA/dev)
            ou <code className="bg-muted px-1 rounded">.env.prod.local</code> (produção).
            Use <code className="bg-muted px-1 rounded">.env.example</code> como referência.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
