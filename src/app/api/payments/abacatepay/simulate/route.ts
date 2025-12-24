import { NextRequest, NextResponse } from 'next/server'

const ABACATEPAY_API_URL = 'https://api.abacatepay.com/v1'

// POST /api/payments/abacatepay/simulate - Simula pagamento PIX (apenas em dev)
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NEXT_PUBLIC_ABACATEPAY_ENV !== 'dev') {
    return NextResponse.json(
      { error: 'Simulação só disponível em ambiente de desenvolvimento' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { pixQrCodeId } = body

    if (!pixQrCodeId) {
      return NextResponse.json(
        { error: 'pixQrCodeId é obrigatório' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ABACATEPAY_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'ABACATEPAY_API_KEY não configurado' },
        { status: 500 }
      )
    }

    // Simular pagamento no Abacate Pay
    const response = await fetch(
      `${ABACATEPAY_API_URL}/pixQrCode/simulate-payment?id=${pixQrCodeId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: {} }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('Erro ao simular pagamento:', error)
      return NextResponse.json(
        { error: `Erro ao simular pagamento: ${error}` },
        { status: response.status }
      )
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: 'Pagamento simulado com sucesso',
      data: result,
    })
  } catch (error) {
    console.error('Erro ao simular pagamento PIX:', error)
    return NextResponse.json(
      { error: 'Erro interno ao simular pagamento' },
      { status: 500 }
    )
  }
}
