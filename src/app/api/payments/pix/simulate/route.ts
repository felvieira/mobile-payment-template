import { NextRequest, NextResponse } from 'next/server'
import { simulatePixPayment } from '@/lib/abacatepay'

// POST /api/payments/pix/simulate - Simula pagamento PIX (apenas dev)
export async function POST(request: NextRequest) {
  try {
    // Verifica ambiente
    const env = process.env.NEXT_PUBLIC_ABACATEPAY_ENV
    if (env !== 'dev') {
      return NextResponse.json(
        { error: 'Simulação disponível apenas em ambiente de desenvolvimento' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { pixId } = body

    if (!pixId) {
      return NextResponse.json({ error: 'pixId é obrigatório' }, { status: 400 })
    }

    await simulatePixPayment(pixId)

    return NextResponse.json({ success: true, message: 'Pagamento simulado com sucesso' })
  } catch (error) {
    console.error('Erro ao simular pagamento:', error)
    return NextResponse.json({ error: 'Erro ao simular pagamento' }, { status: 500 })
  }
}
