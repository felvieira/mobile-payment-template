import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function StripeSandboxPage() {
  return (
    <div className="container max-w-3xl py-12 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sandbox"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold">Stripe Sandbox</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Em desenvolvimento</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>O sandbox do Stripe está disponível no checkout padrão em <code>/checkout/[productId]</code>.</p>
          <p>Cartões de teste Stripe: <code>4242 4242 4242 4242</code> (aprovado), <code>4000 0000 0000 0002</code> (recusado).</p>
          <a href="https://stripe.com/docs/testing" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Documentação de testes Stripe</a>
        </CardContent>
      </Card>
    </div>
  )
}
