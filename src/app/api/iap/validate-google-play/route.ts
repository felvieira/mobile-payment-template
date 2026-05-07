import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { validateGooglePlaySubscription } from '@/lib/google-play/validator'
import { GOOGLE_PLAY_PACKAGE_NAME, VALID_GOOGLE_PLAY_PRODUCT_IDS } from '@/lib/google-play/subscription-config'

// CORS headers for Tauri app
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
}

// Handle preflight requests
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { productId, purchaseToken, autoRenewing } = body as {
            productId: string
            purchaseToken: string
            autoRenewing?: boolean
        }

        console.log('[IAP Server] Validating purchase:', {
            productId,
            purchaseToken: purchaseToken?.substring(0, 20) + '...',
            autoRenewing,
        })

        if (!productId || !purchaseToken) {
            return NextResponse.json(
                { error: 'Missing productId or purchaseToken' },
                { status: 400, headers: corsHeaders }
            )
        }

        if (!VALID_GOOGLE_PLAY_PRODUCT_IDS.includes(productId)) {
            console.log('[IAP Server] Invalid product ID:', productId, 'expected one of:', VALID_GOOGLE_PLAY_PRODUCT_IDS)
            return NextResponse.json(
                { error: 'Invalid product ID' },
                { status: 400, headers: corsHeaders }
            )
        }

        // Auth: NextAuth v5 session
        const session = await auth()
        const userId: string | null =
            (session?.user as ({ id?: string; email?: string | null }) | undefined)?.id ||
            session?.user?.email ||
            null

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
        }

        console.log('[IAP Server] User authenticated:', userId)

        // Validate purchase with Google Play Developer API
        const result = await validateGooglePlaySubscription(
            GOOGLE_PLAY_PACKAGE_NAME,
            productId,
            purchaseToken
        )

        console.log('[IAP Server] Validation result:', {
            isValid: result.isValid,
            expiryDate: result.expiryDate,
            autoRenewing: result.autoRenewing,
            error: result.error,
        })

        // If validation failed and credentials are configured, reject the purchase
        if (!result.isValid && !result.error?.includes('not configured')) {
            console.log('[IAP Server] Purchase validation failed')
            return NextResponse.json(
                { error: 'Invalid purchase', details: result.error },
                { status: 400, headers: corsHeaders }
            )
        }

        // Use validated data if available, otherwise fallback to client data
        const now = new Date()
        let currentPeriodEnd: Date
        let cancelAtPeriodEnd: boolean

        if (result.isValid) {
            currentPeriodEnd = result.expiryDate
            cancelAtPeriodEnd = !result.autoRenewing
        } else {
            console.warn('[IAP Server] Using client-provided data (Google Play validation not available)')
            currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
            cancelAtPeriodEnd = typeof autoRenewing === 'boolean' ? !autoRenewing : false
        }

        const user = await prisma.user.findFirst({
            where: { OR: [{ id: userId }, { email: userId }] },
        })

        // Upsert Subscription
        await prisma.subscription.upsert({
            where: {
                provider_providerSubId: { provider: 'GOOGLE_PLAY', providerSubId: purchaseToken },
            },
            create: {
                userId: user?.id ?? userId,
                customerEmail: user?.email ?? userId,
                provider: 'GOOGLE_PLAY',
                providerSubId: purchaseToken,
                status: 'active',
                planId: productId,
                platform: 'google_play',
                source: 'app',
                productId,
                purchaseToken,
                currentPeriodStart: now,
                currentPeriodEnd,
                cancelAtPeriodEnd,
            },
            update: {
                status: 'active',
                platform: 'google_play',
                source: 'app',
                productId,
                purchaseToken,
                currentPeriodStart: now,
                currentPeriodEnd,
                cancelAtPeriodEnd,
                updatedAt: now,
            },
        })

        // Log the receipt
        await prisma.iAPReceipt.upsert({
            where: { purchaseToken },
            update: { acknowledged: true, updatedAt: now },
            create: {
                userId: user?.id ?? userId,
                customerEmail: user?.email ?? userId,
                purchaseToken,
                productId,
                packageName: GOOGLE_PLAY_PACKAGE_NAME,
                acknowledged: true,
                rawPayload: { productId, autoRenewing, validatedAt: now.toISOString() },
            },
        })

        console.log('[IAP Server] Subscription saved successfully')

        return NextResponse.json({
            success: true,
            subscription: {
                status: 'active',
                platform: 'google_play',
                currentPeriodEnd: currentPeriodEnd.toISOString(),
            },
        }, { headers: corsHeaders })
    } catch (error) {
        console.error('[IAP] Validation error:', error)

        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        )
    }
}
