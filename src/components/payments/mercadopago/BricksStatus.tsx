'use client'
import { initMercadoPago, StatusScreen } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  paymentId: string
  onReady?: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any) => void
}

let mpInitialized = false

export function BricksStatus({ publicKey, paymentId, onReady, onError }: Props) {
  if (!mpInitialized && publicKey) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }

  return (
    <StatusScreen
      initialization={{ paymentId }}
      onReady={onReady}
      onError={onError}
    />
  )
}
