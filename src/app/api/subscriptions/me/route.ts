import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') ?? 'demo-user'
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ subscription: sub })
}
