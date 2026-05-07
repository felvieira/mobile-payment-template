'use client'
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'

interface Props {
  publicKey: string
  preferenceId: string
}

let mpInitialized = false

export function BricksWallet({ publicKey, preferenceId }: Props) {
  if (!mpInitialized && publicKey) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    mpInitialized = true
  }

  return (
    <Wallet
      initialization={{ preferenceId, redirectMode: 'blank' }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customization={{ texts: { valueProp: 'smart_option' } } as any}
    />
  )
}
