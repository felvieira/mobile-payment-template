'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, ExternalLink } from 'lucide-react'

interface Props {
  productId: string
  onError?: (err: string) => void
}

interface BoletoData {
  orderId: string
  digitableLine?: string
  externalResourceUrl?: string
  expiresAt?: string
}

export function TransparentBoleto({ productId, onError }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [boleto, setBoleto] = useState<BoletoData | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!email || !taxId) {
      onError?.('Email e CPF são obrigatórios para boleto')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/process-boleto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerEmail: email,
          customerName: name,
          customerTaxId: taxId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setBoleto(data)
      } else {
        onError?.(data.error || 'Erro ao gerar boleto')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  function copyLine() {
    if (boleto?.digitableLine) {
      navigator.clipboard.writeText(boleto.digitableLine)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (boleto) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          ✅ Boleto gerado! Vence em 3 dias úteis.
        </p>
        {boleto.digitableLine && (
          <div className="space-y-2">
            <Label>Linha digitável</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={boleto.digitableLine}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyLine}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
        {boleto.externalResourceUrl && (
          <Button variant="outline" className="w-full" asChild>
            <a
              href={boleto.externalResourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir boleto PDF
            </a>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Email *</Label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Nome</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome completo"
          className="mt-1"
        />
      </div>
      <div>
        <Label>CPF *</Label>
        <Input
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          placeholder="12345678909"
          className="mt-1"
        />
      </div>
      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Gerar boleto bancário
      </Button>
    </div>
  )
}
