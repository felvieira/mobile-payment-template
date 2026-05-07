'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const CARDS = [
  { number: '4242 4242 4242 4242', brand: 'Visa', result: '✅ Aprovado', cvv: 'qualquer 3 dígitos', expiry: 'qualquer data futura' },
  { number: '4000 0000 0000 0002', brand: 'Visa', result: '❌ Recusado', cvv: 'qualquer', expiry: 'qualquer' },
  { number: '4000 0025 0000 3155', brand: 'Visa', result: '🔐 Requer 3DS', cvv: 'qualquer', expiry: 'qualquer' },
  { number: '4000 0000 0000 9995', brand: 'Visa', result: '❌ Saldo insuficiente', cvv: 'qualquer', expiry: 'qualquer' },
  { number: '5555 5555 5555 4444', brand: 'Mastercard', result: '✅ Aprovado', cvv: 'qualquer', expiry: 'qualquer' },
  { number: '3782 822463 10005', brand: 'AmEx', result: '✅ Aprovado', cvv: '4 dígitos', expiry: 'qualquer' },
]

export function StripeTestCardsTable() {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text.replace(/ /g, ''))
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-3 text-sm">
      <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
        🃏 Cartões de teste
      </h3>
      <div className="space-y-2">
        {CARDS.map((c) => (
          <div key={c.number} className="border rounded-md p-2 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">{c.brand}</span>
              <span className="text-xs">{c.result}</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-muted-foreground">
              {c.number}
              <button
                onClick={() => copy(c.number, c.number)}
                className="opacity-50 hover:opacity-100 ml-1"
              >
                {copied === c.number
                  ? <Check className="h-3 w-3 text-green-500" />
                  : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <div className="text-muted-foreground">CVV: {c.cvv}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground pt-1">
        Use qualquer data futura e qualquer CEP/ZIP.
      </p>
    </div>
  )
}
