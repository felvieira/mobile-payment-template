'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Copy, Check, Loader2, QrCode } from 'lucide-react'
import Image from 'next/image'

interface Props {
  productId: string
  onSuccess?: (orderId: string) => void
  onError?: (err: string) => void
}

interface PixData {
  orderId: string
  paymentId: string | number
  qrCode: string
  qrCodeBase64: string
  ticketUrl?: string
}

export function TransparentPixQR({ productId, onSuccess, onError }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [pix, setPix] = useState<PixData | null>(null)
  const [copied, setCopied] = useState(false)
  const [pollStatus, setPollStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!pix || pollStatus === 'approved') return
    const iv = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payments/mercadopago/status?paymentId=${pix.paymentId}`
        )
        const data = await res.json()
        setPollStatus(data.status)
        if (data.status === 'approved') {
          clearInterval(iv)
          onSuccess?.(pix.orderId)
        }
      } catch {
        // ignore poll errors
      }
    }, 5000)
    return () => clearInterval(iv)
  }, [pix, pollStatus, onSuccess])

  async function handleCreate() {
    if (!email) {
      onError?.('Email obrigatório')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/mercadopago/process-pix', {
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
        setPix(data)
      } else {
        onError?.(data.error || 'Erro ao gerar PIX')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    if (pix?.qrCode) {
      navigator.clipboard.writeText(pix.qrCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (pix) {
    return (
      <div className="space-y-4 text-center">
        {pollStatus === 'approved' ? (
          <p className="text-green-600 font-semibold text-lg">✅ PIX recebido!</p>
        ) : (
          <p className="text-sm text-muted-foreground animate-pulse">
            Aguardando pagamento… (verificando a cada 5s)
          </p>
        )}
        {pix.qrCodeBase64 && (
          <div className="flex justify-center">
            <Image
              src={`data:image/png;base64,${pix.qrCodeBase64}`}
              alt="QR Code PIX"
              width={192}
              height={192}
              className="border rounded-lg"
              unoptimized
            />
          </div>
        )}
        <Button variant="outline" onClick={copyCode} className="w-full">
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Copiar código PIX
            </>
          )}
        </Button>
        {pix.ticketUrl && (
          <a
            href={pix.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline block"
          >
            Abrir no MercadoPago
          </a>
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
        <Label>CPF (opcional)</Label>
        <Input
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          placeholder="12345678909"
          className="mt-1"
        />
      </div>
      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <QrCode className="mr-2 h-4 w-4" />
        Gerar QR Code PIX
      </Button>
    </div>
  )
}
