import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

export default function GooglePlaySandboxPage() {
  return (
    <div className="container max-w-3xl py-12 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sandbox"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold">Google Play IAP</h1>
        <Badge variant="secondary">Tauri only</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>In-App Purchase via Google Play</CardTitle>
          <CardDescription>
            IAP só funciona em APKs Tauri — não é possível testar no browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-2">
            <h3 className="font-semibold">Endpoints disponíveis</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li><code>POST /api/iap/validate-google-play</code> — valida purchase token via Google Play Developer API</li>
              <li><code>POST /api/iap/google-play-rtdn</code> — webhook RTDN do Pub/Sub Google</li>
              <li><code>POST /api/cron/reconcile-google-play</code> — reconciliação diária de assinaturas</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Setup necessário (PER-APP)</h3>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Criar app no Google Play Console</li>
              <li>Configurar Service Account com androidpublisher API</li>
              <li>Criar produtos de assinatura (monthly/annual)</li>
              <li>Configurar RTDN via Pub/Sub</li>
              <li>Definir <code>GOOGLE_PLAY_PACKAGE_NAME</code>, <code>GOOGLE_PLAY_SERVICE_ACCOUNT_JSON</code>, <code>RTDN_WEBHOOK_SECRET</code></li>
            </ol>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">Links</h3>
            <a href="https://developer.android.com/google/play/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Google Play Billing docs</a>
            <a href="https://developer.android.com/google/play/billing/rtdn-reference" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ RTDN Reference</a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
