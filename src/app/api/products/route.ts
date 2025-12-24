import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/products - Lista produtos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'

    const products = await prisma.product.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(products)
  } catch (error) {
    console.error('Erro ao buscar produtos:', error)
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 })
  }
}

// POST /api/products - Cria produto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, price, currency, imageUrl, active, metadata } = body

    if (!name || !price) {
      return NextResponse.json({ error: 'Nome e preço são obrigatórios' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: Math.round(price), // em centavos
        currency: currency || 'BRL',
        imageUrl,
        active: active ?? true,
        metadata,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar produto:', error)
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 })
  }
}
