import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createAbacatePixPayment } from '@/lib/payments/abacate'
import { APP_CONFIG } from '../../../../../app.config'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, customerEmail, planId } = body as {
            userId: string
            customerEmail: string
            planId?: string
        }

        if (!userId || !customerEmail) {
            return NextResponse.json(
                { error: 'userId and customerEmail are required' },
                { status: 400 }
            )
        }

        const resolvedPlanId = planId ?? 'annual'

        // Check for existing active subscription
        const existingSub = await prisma.subscription.findFirst({
            where: {
                userId,
                provider: 'ABACATEPAY',
                status: { in: ['active', 'trialing', 'past_due'] },
            },
        })

        if (existingSub) {
            return NextResponse.json(
                { error: 'User already has an active subscription.' },
                { status: 400 }
            )
        }

        // Check for pending PIX (avoid duplicates)
        const pendingPix = await prisma.subscription.findFirst({
            where: {
                userId,
                provider: 'ABACATEPAY',
                status: 'pending',
                ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
            },
            orderBy: { createdAt: 'desc' },
        })

        if (pendingPix) {
            const raw = pendingPix.rawPayload as Record<string, unknown>
            return NextResponse.json({
                pixId: pendingPix.providerSubId,
                brCode: raw?.brCode,
                brCodeBase64: raw?.brCodeBase64,
                amount: Math.round(APP_CONFIG.pricing.annual * 100),
                status: 'pending',
                expiresAt: pendingPix.currentPeriodEnd,
                plan: resolvedPlanId,
                reused: true,
            })
        }

        // Create PIX payment via Abacate Pay
        console.log('[PIX] Creating payment for user:', userId)
        const abacateResult = await createAbacatePixPayment(userId, customerEmail)
        const pixData = abacateResult.data

        const amountCents = Math.round(APP_CONFIG.pricing.annual * 100)

        // Upsert Subscription
        await prisma.subscription.upsert({
            where: {
                provider_providerSubId: {
                    provider: 'ABACATEPAY',
                    providerSubId: pixData.id,
                },
            },
            create: {
                userId,
                customerEmail,
                provider: 'ABACATEPAY',
                providerSubId: pixData.id,
                status: 'pending',
                planId: resolvedPlanId,
                currentPeriodEnd: pixData.expiresAt ? new Date(pixData.expiresAt) : null,
                rawPayload: {
                    brCode: pixData.brCode,
                    brCodeBase64: pixData.brCodeBase64,
                    amount: amountCents,
                    expiresAt: pixData.expiresAt,
                },
            },
            update: {
                status: 'pending',
                rawPayload: {
                    brCode: pixData.brCode,
                    brCodeBase64: pixData.brCodeBase64,
                    amount: amountCents,
                    expiresAt: pixData.expiresAt,
                },
            },
        })

        console.log('[PIX] Subscription upserted for pixId:', pixData.id)

        return NextResponse.json({
            pixId: pixData.id,
            brCode: pixData.brCode,
            brCodeBase64: pixData.brCodeBase64,
            amount: amountCents,
            status: pixData.status || 'pending',
            expiresAt: pixData.expiresAt,
            plan: resolvedPlanId,
        })
    } catch (error) {
        console.error('[PIX] Error creating payment:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error creating PIX payment' },
            { status: 500 }
        )
    }
}
