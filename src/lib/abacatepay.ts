const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1'

interface PixQrCodeResponse {
  data: {
    id: string
    brCode: string
    brCodeBase64: string
    status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED'
    expiresAt: string
  }
}

interface CreatePixParams {
  amount: number // em centavos
  description: string
  externalReference: string
  expiresIn?: number // segundos (default 3600)
  customer?: {
    name?: string
    email?: string
    phone?: string
    taxId?: string // CPF/CNPJ
  }
}

export async function createPixQrCode(params: CreatePixParams): Promise<PixQrCodeResponse['data']> {
  const apiKey = process.env.ABACATEPAY_API_KEY

  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY não configurado')
  }

  const requestBody = {
    amount: params.amount, // Abacate Pay espera em centavos
    expiresIn: params.expiresIn || 3600,
    description: params.description,
    metadata: {
      externalReference: params.externalReference,
    },
    customer: params.customer ? {
      name: params.customer.name || 'Cliente',
      email: params.customer.email,
      cellphone: params.customer.phone || '5500000000000',
      taxId: formatTaxId(params.customer.taxId || '00000000000'),
    } : undefined,
  }

  const response = await fetch(`${ABACATEPAY_API_URL}/pixQrCode/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Erro ao criar PIX: ${error}`)
  }

  const result: PixQrCodeResponse = await response.json()
  return result.data
}

export async function checkPixStatus(pixId: string): Promise<{ status: string; expiresAt: string }> {
  const apiKey = process.env.ABACATEPAY_API_KEY

  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY não configurado')
  }

  const response = await fetch(`${ABACATEPAY_API_URL}/pixQrCode/check?id=${pixId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Erro ao verificar status PIX: ${response.statusText}`)
  }

  const result = await response.json()
  return {
    status: result.data.status,
    expiresAt: result.data.expiresAt,
  }
}

export async function simulatePixPayment(pixId: string): Promise<void> {
  const apiKey = process.env.ABACATEPAY_API_KEY

  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY não configurado')
  }

  console.log('Simulando PIX:', { pixId, apiKey: apiKey.substring(0, 10) + '...' })

  // Só funciona em ambiente de desenvolvimento
  // API espera id como querystring
  const response = await fetch(`${ABACATEPAY_API_URL}/pixQrCode/simulate-payment?id=${pixId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Erro simulação PIX:', { status: response.status, body: errorBody })
    throw new Error(`Erro ao simular pagamento: ${response.statusText} - ${errorBody}`)
  }

  console.log('PIX simulado com sucesso!')
}

function formatTaxId(taxId: string): string {
  const digits = taxId.replace(/\D/g, '')
  if (digits.length === 11) {
    // CPF: XXX.XXX.XXX-XX
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }
  return taxId
}

export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const calculatedSignature = hmac.digest('hex')

  // Comparação segura contra timing attacks
  if (calculatedSignature.length !== signature.length) return false

  let result = 0
  for (let i = 0; i < calculatedSignature.length; i++) {
    result |= calculatedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
  }

  return result === 0
}
