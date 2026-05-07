'use client'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Smartphone, AlertTriangle } from 'lucide-react'
import { SetupGuide } from '../_components/SetupGuide'

export default function GooglePlaySandboxPage() {
  return (
    <div className="container max-w-5xl py-10 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sandbox"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Google Play IAP</h1>
        <Badge variant="secondary" className="gap-1"><Smartphone className="h-3 w-3" /> Tauri APK only</Badge>
      </div>

      <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div>
          <strong>Importante:</strong> IAP do Google Play <strong>só funciona em APKs Android</strong> distribuídos pela Play Store (ou Internal Testing).
          O fluxo de compra precisa ser invocado pelo cliente Tauri usando o plugin de billing nativo. Aqui no browser você só consegue testar os endpoints server-side (validação, RTDN, reconcile).
        </div>
      </div>

      <Tabs defaultValue="setup">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-2">
          <TabsTrigger value="setup">📘 Setup</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="tauri">Tauri Client</TabsTrigger>
          <TabsTrigger value="info">Sobre IAP</TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Como configurar o Google Play IAP</CardTitle>
              <CardDescription>
                Setup completo: Play Console, Service Account, RTDN via Pub/Sub, Tauri client.
                Todos os passos são PER-APP (cada app tem seu próprio package name e produtos).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SetupGuide
                title="Setup Google Play IAP"
                subtitle="Total: ~30 minutos. Requer conta Google Play Developer ($25 one-time)."
                steps={[
                  {
                    num: 1,
                    title: 'Criar conta Google Play Developer',
                    desc: 'Pagamento único de US$25. Pode demorar 24-48h pra ser aprovada.',
                    href: 'https://play.google.com/console/signup',
                    type: 'reusable',
                  },
                  {
                    num: 2,
                    title: 'Criar app no Play Console',
                    desc: 'No Play Console, clique em "Criar app". Defina o package name (deve ser único globalmente, ex: com.suaempresa.seuapp). Esse package name vai ser usado em GOOGLE_PLAY_PACKAGE_NAME e no app.config.ts do Tauri.',
                    href: 'https://play.google.com/console',
                    type: 'per-app',
                    copy: 'GOOGLE_PLAY_PACKAGE_NAME=com.suaempresa.seuapp',
                  },
                  {
                    num: 3,
                    title: 'Criar produtos de assinatura',
                    desc: 'No app criado, vá em Monetização → Assinaturas. Crie produtos com IDs que match com NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID e _ANNUAL_PRODUCT_ID.',
                    href: 'https://play.google.com/console',
                    type: 'per-app',
                    copy: 'NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID=app_premium_monthly\nNEXT_PUBLIC_GOOGLE_PLAY_ANNUAL_PRODUCT_ID=app_premium_annual',
                    bullets: [
                      'Cada produto: ID, descrição, períodos de cobrança',
                      'Marque como "Ativo" pra ficar disponível',
                      'Configure preços por país',
                    ],
                  },
                  {
                    num: 4,
                    title: 'Conectar projeto Google Cloud',
                    desc: 'No Play Console, vá em Setup → API access. Conecte ou crie um projeto Google Cloud. Esse projeto vai hospedar a Service Account e o tópico Pub/Sub do RTDN.',
                    href: 'https://play.google.com/console',
                    type: 'per-app',
                  },
                  {
                    num: 5,
                    title: 'Criar Service Account',
                    desc: 'No projeto Google Cloud (IAM & Admin → Service Accounts), crie uma service account. Atribua role "Visualizador". Gere uma chave JSON e baixe.',
                    href: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
                    type: 'per-app',
                    bullets: [
                      'Nome: ex. "play-billing-validator"',
                      'Role: Service Account Token Creator (mínimo)',
                      'Criar chave → JSON → download',
                    ],
                  },
                  {
                    num: 6,
                    title: 'Conceder acesso da SA no Play Console',
                    desc: 'De volta no Play Console → API access, conceda permissão "Visualizar informações financeiras" e "Gerenciar pedidos" pra service account criada.',
                    href: 'https://play.google.com/console',
                    type: 'per-app',
                  },
                  {
                    num: 7,
                    title: 'Colar JSON da Service Account no env',
                    desc: 'Pegue o conteúdo do JSON baixado e cole inteiro (em uma linha, escapado se necessário) na var GOOGLE_PLAY_SERVICE_ACCOUNT_JSON.',
                    type: 'per-app',
                    copy: 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON={"type":"service_account",...}',
                  },
                  {
                    num: 8,
                    title: 'Criar tópico Pub/Sub para RTDN',
                    desc: 'No Google Cloud Console, em Pub/Sub → Topics → Create topic. Anote o nome completo do tópico (projects/seu-projeto/topics/google-play-rtdn).',
                    href: 'https://console.cloud.google.com/cloudpubsub/topic/list',
                    type: 'per-app',
                    copy: 'projects/seu-projeto/topics/google-play-rtdn',
                  },
                  {
                    num: 9,
                    title: 'Configurar RTDN no Play Console',
                    desc: 'No Play Console, em Monetização → Notificações em tempo real, cole o nome do tópico Pub/Sub e clique em "Send test notification" pra validar.',
                    href: 'https://play.google.com/console',
                    type: 'per-app',
                  },
                  {
                    num: 10,
                    title: 'Criar Push Subscription apontando pro webhook',
                    desc: 'No Pub/Sub do Google Cloud, no tópico criado, adicione uma subscription do tipo "Push". URL deve incluir o secret RTDN_WEBHOOK_SECRET pra autenticação.',
                    href: 'https://console.cloud.google.com/cloudpubsub/subscription/list',
                    type: 'per-app',
                    copy: 'https://seu-dominio.com/api/iap/google-play-rtdn?secret=SEU_RTDN_SECRET',
                  },
                  {
                    num: 11,
                    title: 'Gerar e configurar RTDN_WEBHOOK_SECRET',
                    desc: 'Gere um string aleatório (openssl rand -base64 32) e use o mesmo valor na URL do Pub/Sub e em RTDN_WEBHOOK_SECRET.',
                    type: 'per-app',
                    copy: 'RTDN_WEBHOOK_SECRET=...',
                  },
                  {
                    num: 12,
                    title: 'Build APK Tauri e upload no Internal Testing',
                    desc: 'No app Tauri, configure o plugin de billing. Build o APK signed com sua keystore e faça upload em Internal Testing no Play Console. Adicione testers.',
                    href: 'https://play.google.com/console',
                    type: 'per-app',
                    bullets: [
                      'Configure keystore conforme docs em setup-apk-iap-guide/',
                      'app.config.ts com packageName igual ao Play Console',
                      'Versionamento (versionCode incrementa a cada upload)',
                    ],
                  },
                  {
                    num: 13,
                    title: 'Testar compra com tester user',
                    desc: 'Tester instala APK do Internal Testing, faz uma compra de teste (não cobra cartão real), e o app chama POST /api/iap/validate-google-play com o purchaseToken.',
                    type: 'per-app',
                  },
                  {
                    num: 14,
                    title: 'Configurar cron de reconciliação',
                    desc: 'Agende um job diário pra chamar /api/cron/reconcile-google-play. Detecta drift entre seu DB e o estado real no Play (cancelamentos silenciosos, refunds, etc.).',
                    type: 'per-app',
                    copy: 'curl -X POST https://seu-dominio.com/api/cron/reconcile-google-play -H "Authorization: Bearer $CRON_SECRET"',
                  },
                ]}
                links={[
                  { label: 'Play Console', href: 'https://play.google.com/console' },
                  { label: 'Google Cloud Console', href: 'https://console.cloud.google.com' },
                  { label: 'Service Accounts', href: 'https://console.cloud.google.com/iam-admin/serviceaccounts' },
                  { label: 'Pub/Sub Topics', href: 'https://console.cloud.google.com/cloudpubsub/topic/list' },
                  { label: 'Docs Play Billing', href: 'https://developer.android.com/google/play/billing' },
                  { label: 'RTDN Reference', href: 'https://developer.android.com/google/play/billing/rtdn-reference' },
                  { label: 'Service Account API access', href: 'https://developers.google.com/android-publisher/getting_started' },
                  { label: 'Tauri Setup Guide', href: 'https://github.com/felvieira/mobile-payment-template/tree/main/setup-apk-iap-guide' },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints">
          <Card>
            <CardHeader>
              <CardTitle>Endpoints disponíveis</CardTitle>
              <CardDescription>Server-side endpoints já implementados pelo template (portados do memrapp).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">POST /api/iap/validate-google-play</code>
                <p className="text-muted-foreground">
                  Recebe purchaseToken e productId do cliente Tauri. Valida via Google Play Developer API e cria/atualiza Subscription no DB.
                </p>
                <p className="text-xs text-muted-foreground">CORS habilitado pra Tauri.</p>
              </div>
              <div className="space-y-1">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">POST /api/iap/google-play-rtdn?secret=xxx</code>
                <p className="text-muted-foreground">
                  Webhook do Pub/Sub. Recebe notificações em tempo real (renovação, cancelamento, refund, etc.) e atualiza o DB. Valida via query param secret.
                </p>
              </div>
              <div className="space-y-1">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">POST /api/cron/reconcile-google-play</code>
                <p className="text-muted-foreground">
                  Reconciliação diária. Lista todas as subscriptions Google Play, valida cada uma contra o Play API e corrige drift. Aceita ?dryRun=1 e ?limit=N. Auth: Bearer CRON_SECRET.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tauri">
          <Card>
            <CardHeader>
              <CardTitle>Como integrar no cliente Tauri</CardTitle>
              <CardDescription>
                O fluxo de compra acontece no APK Android via plugin de billing. Após a compra, o cliente envia o purchaseToken pro backend pra validar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">Fluxo completo</h3>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Usuário toca em "Assinar" no app Android</li>
                  <li>Cliente Tauri invoca o plugin de billing → mostra UI nativa do Google Play</li>
                  <li>Usuário confirma a compra</li>
                  <li>Plugin retorna purchaseToken + autoRenewing</li>
                  <li>App POST <code>/api/iap/validate-google-play</code> com esses dados</li>
                  <li>Backend valida via androidpublisher API e grava no DB</li>
                  <li>Pub/Sub vai mandar RTDN também (paralelo) — ambos são idempotentes</li>
                </ol>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Exemplo de código no cliente</h3>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto">
{`// Após compra bem-sucedida no plugin de billing Tauri:
await fetch('https://seu-dominio.com/api/iap/validate-google-play', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${userToken}\`,
  },
  body: JSON.stringify({
    productId: 'app_premium_monthly',
    purchaseToken: purchase.purchaseToken,
    autoRenewing: purchase.autoRenewing,
  }),
})`}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground">
                Para detalhes do plugin Tauri e build do APK, veja o diretório <code>setup-apk-iap-guide/</code> na raiz do repo.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardHeader><CardTitle>Sobre IAP do Google Play</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                IAP (In-App Purchase) é o sistema da Google Play pra cobrar dentro de apps Android.
                Diferente de cartão direto, o pagamento é gerenciado pelo Google: o usuário usa os métodos cadastrados na conta Google dele.
              </p>
              <p>
                <strong>Vantagens:</strong> obrigatório se você está na Play Store (taxa de 15-30% pra Google). UX excelente, gestão de refunds, suporte multi-idioma e multi-moeda.
              </p>
              <p>
                <strong>Desvantagens:</strong> 15-30% de fee, só funciona em Android, configuração mais complexa, exige conta Play Developer ($25).
              </p>
              <p>
                <strong>Validação obrigatória:</strong> sempre valide o purchaseToken no servidor via androidpublisher API. Tokens podem ser falsificados ou compartilhados — confiar só no cliente é uma vulnerabilidade conhecida.
              </p>
              <p>
                <strong>RTDN:</strong> Real-Time Developer Notifications. O Google manda eventos via Pub/Sub quando algo muda (renovação, cancelamento, refund). Sem isso você só sabe da mudança quando o usuário abre o app.
              </p>
              <p>
                <strong>Reconciliação:</strong> rede falha. Pub/Sub atrasa. Webhooks somem. O cron diário compara seu DB com o Play e corrige discrepâncias.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
