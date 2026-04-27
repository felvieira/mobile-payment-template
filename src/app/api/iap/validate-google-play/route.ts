import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateGooglePlaySubscription } from '@/lib/google-play-validator'

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
    let userId: string | null = null

    try {
        const body = await request.json()
        const { productId, purchaseToken, packageName, userId: bodyUserId, autoRenewing } = body as {
            productId: string
            purchaseToken: string
            packageName?: string
            userId: string
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

        if (!bodyUserId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400, headers: corsHeaders }
            )
        }

        userId = bodyUserId
        const resolvedPackageName = packageName ?? process.env.GOOGLE_PLAY_PACKAGE_NAME ?? ''

        console.log('[IAP Server] User:', userId)

        // Validate purchase with Google Play Developer API
        const validationResult = await validateGooglePlaySubscription(
            resolvedPackageName,
            productId,
            purchaseToken
        )

        console.log('[IAP Server] Validation result:', {
            valid: validationResult.valid,
            expiryTime: validationResult.expiryTime,
            error: (validationResult as { error?: string }).error,
        })

        // If validation failed and credentials are configured, reject the purchase
        if (!validationResult.valid && !(validationResult as { error?: string }).error?.includes('not configured')) {
            console.log('[IAP Server] Purchase validation failed')
            return NextResponse.json(
                { error: 'Invalid purchase', details: (validationResult as { error?: string }).error },
                { status: 400, headers: corsHeaders }
            )
        }

        // Use validated data if available, otherwise fallback to client data
        const now = new Date()
        let currentPeriodEnd: Date
        let cancelAtPeriodEnd: boolean

        if (validationResult.valid && validationResult.expiryTime) {
            // Use real data from Google Play
            currentPeriodEnd = new Date(validationResult.expiryTime)
            cancelAtPeriodEnd = validationResult.acknowledgementState === 0
        } else {
            // Fallback: trust client data (when credentials not configured)
            console.warn('[IAP Server] Using client-provided data (Google Play validation not available)')
            currentPeriodEnd = new Date(now)
            currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1)
            cancelAtPeriodEnd = typeof autoRenewing === 'boolean' ? !autoRenewing : false
        }

        // Upsert IAPReceipt
        await prisma.iAPReceipt.upsert({
            where: { purchaseToken },
            create: {
                userId,
                customerEmail: '',
                purchaseToken,
                productId,
                packageName: resolvedPackageName,
                acknowledged: false,
                rawPayload: validationResult.rawResponse as unknown as never,
            },
            update: {
                acknowledged: false,
                rawPayload: validationResult.rawResponse as unknown as never,
            },
        })

        // Upsert Subscription
        await prisma.subscription.upsert({
            where: {
                provider_providerSubId: { provider: 'GOOGLE_PLAY', providerSubId: purchaseToken },
            },
            create: {
                userId,
                customerEmail: '',
                provider: 'GOOGLE_PLAY',
                providerSubId: purchaseToken,
                status: 'active',
                planId: productId,
                currentPeriodEnd,
                rawPayload: validationResult.rawResponse as unknown as never,
            },
            update: {
                status: 'active',
                currentPeriodEnd,
                rawPayload: validationResult.rawResponse as unknown as never,
            },
        })

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
