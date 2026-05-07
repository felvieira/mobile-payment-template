import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function AbacateSandboxPage() {
  return (
    <div className="container max-w-3xl py-12 space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sandbox"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link>
        </Button>
        <h1 className="text-2xl font-bold">Abacate PIX Sandbox</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>PIX via Abacate Pay</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Teste o PIX via Abacate Pay no checkout padrão em <code>/checkout/[productId]</code>, selecionando o método PIX.</p>
          <p>Configure <code>ABACATE_PAY_ENV=dev</code> e <code>ABACATE_PAY_DEV_API_KEY</code> para usar o ambiente de desenvolvimento.</p>
          <a href="https://docs.abacatepay.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline block">→ Documentação Abacate Pay</a>
        </CardContent>
      </Card>
    </div>
  )
}
