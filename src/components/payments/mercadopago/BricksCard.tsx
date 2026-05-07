'use client'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  amount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit?: (formData: any) => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any) => void
  onReady?: () => void
}

let mpInitialized = false

export function BricksCard({ publicKey, amount, onSubmit, onError, onReady }: Props) {
  if (!mpInitialized && publicKey) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }

  return (
    <CardPayment
      initialization={{ amount }}
      onSubmit={onSubmit ?? (async () => {})}
      onError={onError}
      onReady={onReady}
    />
  )
}
