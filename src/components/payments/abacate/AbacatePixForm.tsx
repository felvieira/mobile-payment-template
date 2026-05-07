'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, QrCode, Zap } from 'lucide-react'
import Image from 'next/image'

interface Props {
  productId: string
  onSuccess?: (orderId: string) => void
  onError?: (err: string) => void
  showSimulateButton?: boolean // only in dev
}

interface PixData {
  orderId: string
  pixId: string
  brCode: string
  brCodeBase64: string
  status: string
  expiresAt: string
  amount: number
}

export function AbacatePixForm({ productId, onSuccess, onError, showSimulateButton = true }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [pix, setPix] = useState<PixData | null>(null)
  const [copied, setCopied] = useState(false)
  const [pollStatus, setPollStatus] = useState<string | null>(null)

  // Poll for payment confirmation
  useEffect(() => {
    if (!pix || pollStatus === 'PAID' || pollStatus === 'EXPIRED') return

    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/pix/status?orderId=${pix.orderId}`)
        const data = await res.json()
        setPollStatus(data.status)
        if (data.status === 'PAID') {
          clearInterval(iv)
          onSuccess?.(pix.orderId)
        }
      } catch {
        // ignore poll errors
      }
    }, 3000)

    return () => clearInterval(iv)
  }, [pix, pollStatus, onSuccess])

  async function handleCreate() {
    if (!email) { onError?.('Email obrigatório'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/payments/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerEmail: email,
          customerName: name || undefined,
          customerPhone: phone || undefined,
          customerTaxId: taxId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data.brCode) {
        setPix(data)
        setPollStatus(data.status)
      } else {
        onError?.(data.error || 'Erro ao gerar PIX')
      }
    } catch {
      onError?.('Erro de rede')
    } finally {
      setLoading(false)
    }
  }

  async function handleSimulate() {
    if (!pix) return
    setSimulating(true)
    try {
      const res = await fetch('/api/payments/abacatepay/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixQrCodeId: pix.pixId }),
      })
      const data = await res.json()
      if (!res.ok) {
        onError?.(data.error || 'Erro ao simular pagamento')
      }
      // polling will catch the PAID status automatically
    } catch {
      onError?.('Erro ao simular')
    } finally {
      setSimulating(false)
    }
  }

  function copyCode() {
    if (pix?.brCode) {
      navigator.clipboard.writeText(pix.brCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Show QR code screen
  if (pix) {
    return (
      <div className="space-y-4">
        {pollStatus === 'PAID' ? (
          <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 font-semibold text-lg">✅ Pagamento confirmado!</p>
            <p className="text-green-600 text-sm">Order ID: {pix.orderId}</p>
          </div>
        ) : pollStatus === 'EXPIRED' ? (
          <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-semibold">⏱️ PIX expirado</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setPix(null); setPollStatus(null) }}>
              Gerar novo PIX
            </Button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground animate-pulse mb-3">
              Aguardando pagamento… (verificando a cada 3s)
            </p>
            {pix.brCodeBase64 && (
              <div className="flex justify-center mb-3">
                <Image
                  src={`data:image/png;base64,${pix.brCodeBase64}`}
                  alt="QR Code PIX"
                  width={200}
                  height={200}
                  className="border rounded-xl shadow-sm"
                  unoptimized
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground mb-3">
              Valor: R${(pix.amount / 100).toFixed(2)} · Expira em: {new Date(pix.expiresAt).toLocaleTimeString('pt-BR')}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyCode} className="flex-1">
                {copied
                  ? <><Check className="mr-2 h-4 w-4" />Copiado!</>
                  : <><Copy className="mr-2 h-4 w-4" />Copiar código</>}
              </Button>
              {showSimulateButton && (
                <Button onClick={handleSimulate} disabled={simulating} variant="secondary" className="flex-1">
                  {simulating
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Simulando…</>
                    : <><Zap className="mr-2 h-4 w-4" />Simular pagamento</>}
                </Button>
              )}
            </div>
            {showSimulateButton && (
              <p className="text-xs text-muted-foreground mt-2">
                ⚡ &quot;Simular pagamento&quot; só funciona em ambiente dev (Abacate Pay API)
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  // Show form
  return (
    <div className="space-y-4">
      <div>
        <Label>Email *</Label>
        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="mt-1" />
      </div>
      <div>
        <Label>Nome</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome completo" className="mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Telefone</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="5511999999999" className="mt-1" />
        </div>
        <div>
          <Label>CPF</Label>
          <Input value={taxId} onChange={e => setTaxId(e.target.value)} placeholder="00000000000" className="mt-1" />
        </div>
      </div>
      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <QrCode className="mr-2 h-4 w-4" />
        Gerar QR Code PIX
      </Button>
    </div>
  )
}
