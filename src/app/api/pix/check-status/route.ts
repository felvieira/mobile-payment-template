import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkAbacatePixStatus } from '@/lib/payments/abacate'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { pixId, userId } = body as { pixId: string; userId: string }

        if (!pixId) {
            return NextResponse.json({ error: 'pixId is required' }, { status: 400 })
        }

        // Proxy to Abacate Pay
        const abacateResult = await checkAbacatePixStatus(pixId)
        const newStatus = abacateResult.data.status

        // If we have a userId, update the Subscription row
        if (userId) {
            const sub = await prisma.subscription.findFirst({
                where: {
                    provider: 'ABACATEPAY',
                    providerSubId: pixId,
                    userId,
                },
            })

            if (sub && newStatus !== sub.status) {
                const mappedStatus = newStatus === 'PAID' ? 'active'
                    : newStatus === 'EXPIRED' || newStatus === 'CANCELLED' ? 'expired'
                    : sub.status

                await prisma.subscription.update({
                    where: { id: sub.id },
                    data: {
                        status: mappedStatus,
                        ...(newStatus === 'PAID' ? {
                            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                        } : {}),
                    },
                })
            }
        }

        return NextResponse.json({
            status: newStatus,
            pixId,
            expiresAt: abacateResult.data.expiresAt,
        })
    } catch (error) {
        console.error('[PIX] Error checking status:', error)
        return NextResponse.json(
            { error: 'Error checking PIX status' },
            { status: 500 }
        )
    }
}
