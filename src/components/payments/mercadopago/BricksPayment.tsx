'use client'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  preferenceId: string
  amount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit?: (param: any) => Promise<void>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError?: (err: any) => void
  onReady?: () => void
}

let mpInitialized = false

export function BricksPayment({ publicKey, preferenceId, amount, onSubmit, onError, onReady }: Props) {
  if (!mpInitialized && publicKey) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }

  return (
    <Payment
      initialization={{ amount, preferenceId }}
      customization={{
        paymentMethods: {
          ticket: 'all',
          bankTransfer: 'all',
          creditCard: 'all',
          debitCard: 'all',
          mercadoPago: 'all',
        },
      } as Parameters<typeof Payment>[0]['customization']}
      onSubmit={onSubmit ?? (async () => {})}
      onError={onError}
      onReady={onReady}
    />
  )
}
