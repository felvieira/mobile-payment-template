import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateGooglePlaySubscription } from '@/lib/google-play/validator'
import { GOOGLE_PLAY_PACKAGE_NAME } from '@/lib/google-play/subscription-config'

/**
 * Reconcile Google Play subscriptions against the platform.
 *
 * Why: even with RTDN configured, notifications can be missed (Pub/Sub
 * outage, signing rotation, network blip, etc.). This cron runs daily as
 * a safety net to catch drift between our local state and the real
 * Google Play state.
 *
 * Scope: every Google Play subscription with a purchase_token, regardless
 * of current status. We process in small batches and rate-limit the API
 * calls to avoid hitting Google Play quotas.
 *
 * Authentication: Bearer ${CRON_SECRET}
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
        }
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 2000)
        const dryRun = url.searchParams.get('dryRun') === '1'

        console.log(`[Reconcile] starting (limit=${limit}, dryRun=${dryRun}) at ${new Date().toISOString()}`)

        // Pull every Google Play subscription with a token. Order by oldest update first
        // so reconciliation is fair even when row count > limit.
        const rows = await prisma.subscription.findMany({
            where: {
                provider: 'GOOGLE_PLAY',
                purchaseToken: { not: null },
            },
            orderBy: { updatedAt: 'asc' },
            take: limit,
        })

        if (!rows.length) {
            console.log('[Reconcile] no Google Play rows to check')
            return NextResponse.json({ success: true, checked: 0 })
        }

        let drifted = 0       // Local state was wrong, we corrected it
        let confirmed = 0     // Local state matched real state
        let errored = 0       // Validator threw — we left the row alone
        const drifts: Array<{ userId: string; from: string; to: string; reason: string }> = []

        const now = new Date()

        for (const row of rows) {
            if (!row.productId || !row.purchaseToken) continue

            try {
                const real = await validateGooglePlaySubscription(
                    GOOGLE_PLAY_PACKAGE_NAME,
                    row.productId,
                    row.purchaseToken
                )

                const localExpiry = row.currentPeriodEnd ?? null
                const localActive = row.status === 'active'
                const realActive = real.isValid && real.expiryDate > now

                // Case A: real expiry is later than local → user renewed silently
                if (real.isValid && localExpiry && real.expiryDate > localExpiry) {
                    if (!dryRun) {
                        await prisma.subscription.update({
                            where: { id: row.id },
                            data: {
                                status: 'active',
                                platform: 'google_play',
                                source: 'app',
                                productId: row.productId,
                                purchaseToken: row.purchaseToken,
                                currentPeriodStart: now,
                                currentPeriodEnd: real.expiryDate,
                                cancelAtPeriodEnd: !real.autoRenewing,
                            },
                        })
                    }
                    drifted++
                    drifts.push({
                        userId: row.userId,
                        from: localExpiry.toISOString(),
                        to: real.expiryDate.toISOString(),
                        reason: 'renewed',
                    })
                    continue
                }

                // Case B: local says active but Google Play says not → expire/cancel
                if (localActive && !realActive) {
                    if (!dryRun) {
                        const newStatus = real.cancelReason ? 'canceled' : 'expired'
                        await prisma.subscription.update({
                            where: { id: row.id },
                            data: { status: newStatus, cancelAtPeriodEnd: true },
                        })
                    }
                    drifted++
                    drifts.push({
                        userId: row.userId,
                        from: 'active',
                        to: real.cancelReason ? 'canceled' : 'expired',
                        reason: real.cancelReason || 'expired_on_platform',
                    })
                    continue
                }

                // Case C: local says NOT active but Google Play says active → user is paying!
                if (!localActive && realActive) {
                    if (!dryRun) {
                        await prisma.subscription.update({
                            where: { id: row.id },
                            data: {
                                status: 'active',
                                platform: 'google_play',
                                source: 'app',
                                productId: row.productId,
                                purchaseToken: row.purchaseToken,
                                currentPeriodStart: now,
                                currentPeriodEnd: real.expiryDate,
                                cancelAtPeriodEnd: !real.autoRenewing,
                            },
                        })
                    }
                    drifted++
                    drifts.push({
                        userId: row.userId,
                        from: row.status,
                        to: 'active',
                        reason: 'recovered',
                    })
                    continue
                }

                // Case D: cancelAtPeriodEnd mismatch
                const localCancelFlag = row.cancelAtPeriodEnd
                const realCancelFlag = !real.autoRenewing
                if (real.isValid && localCancelFlag !== realCancelFlag) {
                    if (!dryRun) {
                        await prisma.subscription.update({
                            where: { id: row.id },
                            data: { cancelAtPeriodEnd: realCancelFlag },
                        })
                    }
                    drifted++
                    drifts.push({
                        userId: row.userId,
                        from: `cancelAtPeriodEnd=${localCancelFlag}`,
                        to: `cancelAtPeriodEnd=${realCancelFlag}`,
                        reason: 'auto_renew_changed',
                    })
                    continue
                }

                confirmed++
            } catch (err) {
                errored++
                console.error(`[Reconcile] validate failed for user ${row.userId}:`, err)
            }
        }

        console.log(`[Reconcile] done. checked=${rows.length} drifted=${drifted} confirmed=${confirmed} errored=${errored}`)

        return NextResponse.json({
            success: true,
            checked: rows.length,
            drifted,
            confirmed,
            errored,
            drifts,
            dryRun,
        })
    } catch (error) {
        console.error('[Reconcile] unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    return POST(request)
}
