import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Webhook endpoint for Abacate Pay PIX payment confirmations.
 * Configure in Abacate Pay dashboard:
 *   https://your-domain.com/api/pix/webhook?webhookSecret=YOUR_SECRET
 *
 * Events handled: transparent.completed (PIX paid)
 *
 * This is a fallback — the polling in check-status also activates subscriptions.
 * Having both ensures no payment is missed.
 */
export async function POST(request: NextRequest) {
    try {
        // Optional: validate webhook secret from query param
        const webhookSecret = process.env.ABACATE_PAY_WEBHOOK_SECRET
        if (webhookSecret) {
            const url = new URL(request.url)
            const querySecret = url.searchParams.get('webhookSecret')
            if (querySecret !== webhookSecret) {
                console.warn('[PIX Webhook] Invalid webhook secret')
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        const body = await request.json()
        const event = body?.event as string | undefined
        console.log('[PIX Webhook] Received event:', event, 'id:', body?.id)

        // Extract PIX charge ID from the payload
        // v2 format: { event: "transparent.completed", data: { id, status, ... } }
        // v1 format: { data: { id, status } } or { pixQrCode: { id, status } }
        const pixId = body?.data?.id || body?.pixQrCode?.id || body?.id
        const status = body?.data?.status || body?.pixQrCode?.status || body?.status

        // Only process completion events
        // v1 webhook fires "billing.paid", v2 fires "transparent.completed"
        const isCompleted = event === 'billing.paid'
            || event === 'transparent.completed'
            || status === 'PAID'
            || status === 'paid'

        if (!pixId) {
            console.warn('[PIX Webhook] Missing pixId in payload')
            return NextResponse.json({ received: true, warning: 'missing pixId' })
        }

        // Find subscription by Abacate payment ID
        const sub = await prisma.subscription.findFirst({
            where: {
                provider: 'ABACATEPAY',
                providerSubId: pixId,
            },
        })

        if (!sub) {
            console.warn('[PIX Webhook] Subscription not found for pixId:', pixId)
            return NextResponse.json({ received: true, warning: 'subscription not found' })
        }

        // Idempotent — already processed
        if (sub.status === 'active') {
            console.log('[PIX Webhook] Already active, skipping:', sub.id)
            return NextResponse.json({ received: true, already_processed: true })
        }

        if (isCompleted) {
            const periodEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

            await prisma.subscription.update({
                where: { id: sub.id },
                data: {
                    status: 'active',
                    currentPeriodEnd: periodEnd,
                },
            })

            console.log('[PIX Webhook] Subscription activated for userId:', sub.userId)
        } else {
            // Update other statuses (EXPIRED, CANCELLED, REFUNDED, etc.)
            const normalizedStatus = (status || 'pending').toLowerCase() as string
            const mappedStatus = normalizedStatus === 'expired' || normalizedStatus === 'cancelled'
                ? 'expired'
                : normalizedStatus

            await prisma.subscription.update({
                where: { id: sub.id },
                data: { status: mappedStatus },
            })
        }

        return NextResponse.json({ received: true, processed: true })
    } catch (error) {
        console.error('[PIX Webhook] Error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
