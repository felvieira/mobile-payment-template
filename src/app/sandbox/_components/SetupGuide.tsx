'use client'
import { useState } from 'react'
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react'

export interface SetupStep {
  /** Step number/label shown at left */
  num: number
  /** Short imperative title (e.g. "Criar conta no Stripe") */
  title: string
  /** Optional longer explanation */
  desc?: string
  /** Optional URL — renders an "Abrir" button next to the step */
  href?: string
  /** Optional code/value to copy — useful for webhook URLs, vars, etc. */
  copy?: string
  /** Optional sub-bullets shown under the description */
  bullets?: string[]
  /** PER-APP (orange) vs REUSABLE (blue) — defaults to per-app */
  type?: 'reusable' | 'per-app'
}

export interface SetupGuideProps {
  title: string
  subtitle?: string
  steps: SetupStep[]
  /** Quick-reference links shown at bottom */
  links?: { label: string; href: string }[]
}

export function SetupGuide({ title, subtitle, steps, links }: SetupGuideProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-base">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const typeColor =
            step.type === 'reusable'
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : 'bg-orange-100 text-orange-700 border-orange-200'
          const typeLabel = step.type === 'reusable' ? 'REUSABLE' : 'PER-APP'

          return (
            <div
              key={step.num}
              className="flex gap-3 p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors"
            >
              <div className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                {step.num}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <h4 className="font-medium text-sm leading-snug">{step.title}</h4>
                  {step.type && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${typeColor} shrink-0`}
                    >
                      {typeLabel}
                    </span>
                  )}
                </div>

                {step.desc && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                )}

                {step.bullets && step.bullets.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside pl-1">
                    {step.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2 items-center">
                  {step.href && (
                    <a
                      href={step.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir no painel
                    </a>
                  )}
                  {step.copy && (
                    <button
                      onClick={() => copy(step.copy!, `step-${step.num}`)}
                      className="inline-flex items-center gap-1 text-xs font-mono bg-muted px-2 py-1 rounded border hover:bg-muted/70 transition-colors max-w-full"
                      title="Clique para copiar"
                    >
                      {copiedKey === `step-${step.num}` ? (
                        <>
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 shrink-0" />
                          <span className="truncate">{step.copy}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {links && links.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs font-semibold text-muted-foreground mb-2">📎 Links úteis</p>
          <div className="flex flex-wrap gap-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>REUSABLE</strong> = configura uma vez e reutiliza em todos os apps da mesma conta.{' '}
          <strong>PER-APP</strong> = precisa criar/configurar para cada novo projeto.
        </div>
      </div>
    </div>
  )
}
