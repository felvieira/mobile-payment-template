import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateGooglePlaySubscription } from '@/lib/google-play-validator'

/**
 * Google Play Real-Time Developer Notifications (RTDN) webhook.
 *
 * Configure in Google Play Console → Monetization → Subscriptions →
 * Real-time developer notifications:
 *   Topic name: projects/<gcp-project>/topics/<app>-rtdn
 *
 * Then subscribe a Pub/Sub Push subscription to:
 *   https://your-domain.com/api/iap/google-play-rtdn?secret=<RTDN_WEBHOOK_SECRET>
 *
 * Pub/Sub delivers notifications as:
 * {
 *   "message": {
 *     "data": "<base64 of JSON DeveloperNotification>",
 *     "messageId": "...",
 *     "publishTime": "..."
 *   },
 *   "subscription": "..."
 * }
 */

// Subscription notification types from Google
// https://developer.android.com/google/play/billing/rtdn-reference#sub
const NOTIFICATION_TYPES: Record<number, string> = {
    1: 'SUBSCRIPTION_RECOVERED',
    2: 'SUBSCRIPTION_RENEWED',
    3: 'SUBSCRIPTION_CANCELED',
    4: 'SUBSCRIPTION_PURCHASED',
    5: 'SUBSCRIPTION_ON_HOLD',
    6: 'SUBSCRIPTION_IN_GRACE_PERIOD',
    7: 'SUBSCRIPTION_RESTARTED',
    8: 'SUBSCRIPTION_PRICE_CHANGE_CONFIRMED',
    9: 'SUBSCRIPTION_DEFERRED',
    10: 'SUBSCRIPTION_PAUSED',
    11: 'SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED',
    12: 'SUBSCRIPTION_REVOKED',
    13: 'SUBSCRIPTION_EXPIRED',
    20: 'SUBSCRIPTION_PENDING_PURCHASE_CANCELED',
}

// Notification types that mean "user is currently entitled to premium"
const ACTIVE_TYPES = new Set([1, 2, 4, 6, 7])
// Notification types that mean "user is no longer entitled"
const INACTIVE_TYPES = new Set([3, 5, 10, 12, 13])

export async function POST(request: NextRequest) {
    let payload: unknown = null
    try {
        // Optional shared-secret protection via query param.
        const expectedSecret = process.env.RTDN_WEBHOOK_SECRET
        if (expectedSecret) {
            const url = new URL(request.url)
            const provided = url.searchParams.get('secret')
            if (provided !== expectedSecret) {
                console.warn('[RTDN] Invalid webhook secret')
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        payload = await request.json()
        const body = payload as { message?: { data?: string; messageId?: string; publishTime?: string } }

        // Pub/Sub envelope check
        if (!body?.message?.data) {
            console.warn('[RTDN] Malformed Pub/Sub envelope')
            // ACK anyway so Pub/Sub doesn't retry — bad payloads aren't recoverable.
            return NextResponse.json({ received: true, warning: 'no message.data' })
        }

        // Decode base64 → JSON
        let notification: Record<string, unknown>
        try {
            const decoded = Buffer.from(body.message.data, 'base64').toString('utf8')
            notification = JSON.parse(decoded)
        } catch (e) {
            console.error('[RTDN] Failed to decode message data:', e)
            return NextResponse.json({ received: true, error: 'decode failed' })
        }

        // Test notification — just ACK
        if (notification?.testNotification) {
            console.log('[RTDN] Received test notification:', notification.testNotification)
            return NextResponse.json({ received: true, test: true })
        }

        // Voided purchase (refunds) — revoke if user found
        if (notification?.voidedPurchaseNotification) {
            const v = notification.voidedPurchaseNotification as { purchaseToken?: string }
            console.log('[RTDN] Voided purchase:', v)
            if (v.purchaseToken) {
                const sub = await prisma.subscription.findFirst({
                    where: { provider: 'GOOGLE_PLAY', providerSubId: v.purchaseToken },
                })
                if (sub) {
                    await prisma.subscription.update({
                        where: { id: sub.id },
                        data: { status: 'canceled' },
                    })
                }
            }
            return NextResponse.json({ received: true })
        }

        // Subscription notification — the main case we care about
        const subNotif = notification?.subscriptionNotification as {
            notificationType?: number
            purchaseToken?: string
            subscriptionId?: string
        } | undefined

        if (!subNotif) {
            console.log('[RTDN] Notification with no subscriptionNotification, ignoring')
            return NextResponse.json({ received: true })
        }

        const { notificationType, purchaseToken, subscriptionId } = subNotif
        const eventName = NOTIFICATION_TYPES[notificationType ?? 0] || `unknown_${notificationType}`
        console.log(`[RTDN] ${eventName} for product ${subscriptionId}`)

        if (!purchaseToken || !subscriptionId) {
            console.warn('[RTDN] Missing purchaseToken or subscriptionId')
            return NextResponse.json({ received: true, warning: 'missing fields' })
        }

        const packageName = (notification.packageName as string) ?? process.env.GOOGLE_PLAY_PACKAGE_NAME ?? ''

        // Look up user by purchase token
        const row = await prisma.subscription.findFirst({
            where: { provider: 'GOOGLE_PLAY', providerSubId: purchaseToken },
        })

        if (!row) {
            // Common case: SUBSCRIPTION_PURCHASED RTDN can arrive before the client posts to
            // /api/iap/validate-google-play. Just ACK — the validate call will create the row.
            console.log(`[RTDN] No local user found for purchase_token ${purchaseToken.slice(0, 20)}... (event=${eventName})`)
            return NextResponse.json({ received: true, user_not_found: true })
        }

        if (notificationType !== undefined && ACTIVE_TYPES.has(notificationType)) {
            const real = await validateGooglePlaySubscription(packageName, subscriptionId, purchaseToken)
            if (real.valid && real.expiryTime) {
                await prisma.subscription.update({
                    where: { id: row.id },
                    data: {
                        status: 'active',
                        currentPeriodEnd: new Date(real.expiryTime),
                        rawPayload: real.rawResponse as Record<string, unknown>,
                    },
                })
                console.log(`[RTDN] ${eventName}: extended ${row.userId} to ${real.expiryTime}`)
            } else {
                console.warn(`[RTDN] ${eventName} but Google Play validator says invalid:`, (real as { error?: string }).error)
            }
        } else if (notificationType !== undefined && INACTIVE_TYPES.has(notificationType)) {
            if (notificationType === 3) {
                // User cancelled — keep active, just flag cancel_at_period_end via status
                const real = await validateGooglePlaySubscription(packageName, subscriptionId, purchaseToken)
                await prisma.subscription.update({
                    where: { id: row.id },
                    data: {
                        status: 'active',
                        currentPeriodEnd: real.expiryTime ? new Date(real.expiryTime) : row.currentPeriodEnd,
                        rawPayload: real.rawResponse as Record<string, unknown>,
                    },
                })
                console.log(`[RTDN] CANCELED: flagged ${row.userId} as cancel_at_period_end`)
            } else {
                // EXPIRED / REVOKED / ON_HOLD / PAUSED — remove access
                const newStatus = notificationType === 13 ? 'expired' : 'canceled'
                await prisma.subscription.update({
                    where: { id: row.id },
                    data: { status: newStatus },
                })
                console.log(`[RTDN] ${eventName}: marked ${row.userId} as ${newStatus}`)
            }
        }

        return NextResponse.json({ received: true, processed: true, event: eventName })
    } catch (error) {
        console.error('[RTDN] Unexpected error:', error)
        // Return 200 so Pub/Sub doesn't retry forever on a bug — we logged it.
        return NextResponse.json({ received: true, error: 'processing_failed' })
    }
}
