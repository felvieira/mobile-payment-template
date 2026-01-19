import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Google Play Product ID must match the one in the app
const GOOGLE_PLAY_PRODUCT_ID = 'memra_premium_monthly';

// CORS headers for Tauri app
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

// Handle preflight requests
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
    try {
        const { productId, purchaseToken } = await request.json();

        if (!productId || !purchaseToken) {
            return NextResponse.json(
                { error: 'Missing productId or purchaseToken' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Validate product ID
        if (productId !== GOOGLE_PLAY_PRODUCT_ID) {
            return NextResponse.json(
                { error: 'Invalid product ID' },
                { status: 400, headers: corsHeaders }
            );
        }

        // Get authenticated user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401, headers: corsHeaders }
            );
        }

        // TODO: Validate purchase with Google Play Developer API
        // For now, we trust the purchase (you should add server-side validation in production)
        // See: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptions/get

        // Calculate subscription period (monthly)
        const now = new Date();
        const currentPeriodEnd = new Date(now);
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

        // Upsert subscription in database
        const { error: upsertError } = await supabase
            .from('subscriptions')
            .upsert({
                user_id: user.id,
                status: 'active',
                platform: 'google_play',
                product_id: productId,
                purchase_token: purchaseToken,
                current_period_start: now.toISOString(),
                current_period_end: currentPeriodEnd.toISOString(),
                cancel_at_period_end: false,
                updated_at: now.toISOString(),
            }, {
                onConflict: 'user_id',
            });

        if (upsertError) {
            console.error('[IAP] Database error:', upsertError);
            return NextResponse.json(
                { error: 'Failed to save subscription' },
                { status: 500, headers: corsHeaders }
            );
        }

        return NextResponse.json({
            success: true,
            subscription: {
                status: 'active',
                platform: 'google_play',
                currentPeriodEnd: currentPeriodEnd.toISOString(),
            }
        }, { headers: corsHeaders });

    } catch (error) {
        console.error('[IAP] Validation error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500, headers: corsHeaders }
        );
    }
}
