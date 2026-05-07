'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const CARDS = [
  { brand: 'Mastercard', number: '5031433215406351', display: '5031 4332 1540 6351', cvv: '123', expiry: '11/30' },
  { brand: 'Visa', number: '4235647728025682', display: '4235 6477 2802 5682', cvv: '123', expiry: '11/30' },
  { brand: 'AmEx', number: '375365153556885', display: '3753 651535 56885', cvv: '1234', expiry: '11/30' },
  { brand: 'Elo Débito', number: '5067766783888311', display: '5067 7667 8388 8311', cvv: '123', expiry: '11/30' },
]

const CPF_MAP = [
  { cpf: '12345678909', status: 'APRO', desc: 'Aprovado' },
  { cpf: '12345678909', status: 'OTHE', desc: 'Recusado (erro geral)' },
  { cpf: '12345678909', status: 'CONT', desc: 'Pendente' },
  { cpf: '12345678909', status: 'CALL', desc: 'Recusado com validação' },
  { cpf: '12345678909', status: 'FUND', desc: 'Saldo insuficiente' },
  { cpf: '12345678909', status: 'SECU', desc: 'CVV inválido' },
  { cpf: '12345678909', status: 'EXPI', desc: 'Validade inválida' },
  { cpf: '12345678909', status: 'FORM', desc: 'Erro no formulário' },
]

export function TestCardsTable() {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-5 text-sm">
      <div>
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          🃏 Cartões de teste
        </h3>
        <div className="space-y-2">
          {CARDS.map((c) => (
            <div key={c.number} className="border rounded-md p-2 text-xs space-y-1">
              <div className="font-medium">{c.brand}</div>
              <div className="flex items-center gap-1 font-mono text-muted-foreground">
                {c.display}
                <button
                  onClick={() => copy(c.number, `card-${c.number}`)}
                  className="opacity-50 hover:opacity-100 ml-1"
                  title="Copiar número"
                >
                  {copied === `card-${c.number}` ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div className="flex gap-3 text-muted-foreground">
                <span>CVV: <strong>{c.cvv}</strong></span>
                <span>Val: <strong>{c.expiry}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          🆔 CPFs de teste
        </h3>
        <div className="space-y-1">
          {CPF_MAP.map((c) => (
            <div key={c.status} className="flex items-center justify-between text-xs border rounded px-2 py-1">
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                {c.cpf}
                <button
                  onClick={() => copy(c.cpf, `cpf-${c.status}`)}
                  className="opacity-50 hover:opacity-100"
                >
                  {copied === `cpf-${c.status}` ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </span>
              <span className="font-mono font-bold text-xs">{c.status}</span>
              <span className="text-muted-foreground">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-2">
          👤 Usuários de teste
        </h3>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><strong>Seller:</strong> TESTUSER8540916956785474261</p>
          <p><strong>Senha:</strong> mkEI0Mg28y</p>
          <p className="pt-1"><strong>Buyer:</strong> TESTUSER1533392031803184682</p>
          <p><strong>Senha:</strong> sbEE8c3ikt</p>
        </div>
      </div>
    </div>
  )
}
