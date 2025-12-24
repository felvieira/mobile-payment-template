const MERCADOPAGO_API_URL = 'https://api.mercadopago.com'

interface MercadoPagoPreference {
  id: string
  init_point: string
  sandbox_init_point: string
}

interface CreatePreferenceParams {
  title: string
  description?: string
  amount: number // em centavos
  quantity?: number
  externalReference: string
  payerEmail?: string
  payerName?: string
  backUrls?: {
    success: string
    failure: string
    pending: string
  }
  notificationUrl?: string
  installments?: number
}

export async function createPreference(params: CreatePreferenceParams): Promise<MercadoPagoPreference> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const backUrls = {
    success: `${appUrl}/success?provider=mercadopago`,
    failure: `${appUrl}/checkout?error=payment_failed`,
    pending: `${appUrl}/success?provider=mercadopago&status=pending`,
  }

  // Mercado Pago não aceita localhost com auto_return
  const isLocalhost = appUrl.includes('localhost')

  const preferenceData: Record<string, unknown> = {
    items: [
      {
        id: params.externalReference,
        title: params.title,
        description: params.description || params.title,
        category_id: 'services',
        quantity: params.quantity || 1,
        currency_id: 'BRL',
        unit_price: params.amount / 100, // Mercado Pago espera em reais
      },
    ],
    back_urls: params.backUrls || backUrls,
    // auto_return só funciona com URLs públicas (não localhost)
    ...(isLocalhost ? {} : { auto_return: 'approved' }),
    payment_methods: {
      excluded_payment_types: [],
      installments: params.installments || 12,
    },
    notification_url: params.notificationUrl || `${appUrl}/api/payments/mercadopago/webhook`,
    statement_descriptor: 'PAYMENTHUB',
    external_reference: params.externalReference,
  }

  // Só adiciona payer se tiver email
  if (params.payerEmail) {
    preferenceData.payer = {
      email: params.payerEmail,
      ...(params.payerName && { name: params.payerName }),
    }
  }

  const response = await fetch(`${MERCADOPAGO_API_URL}/checkout/preferences`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferenceData),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro ao criar preferência Mercado Pago: ${error}`)
  }

  return response.json()
}

export async function getPayment(paymentId: string) {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  }

  const response = await fetch(`${MERCADOPAGO_API_URL}/v1/payments/${paymentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Erro ao buscar pagamento: ${response.statusText}`)
  }

  return response.json()
}
