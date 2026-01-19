"use client"

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getApiUrl, isRunningInTauri } from '@/lib/env';

// Google Play Product ID - must match EXACTLY what's in Google Play Console
export const GOOGLE_PLAY_PRODUCT_ID = 'memra_premium_monthly';

/**
 * Abre uma URL externa no navegador do sistema.
 * Usa plugin-shell no Tauri e window.location na web.
 */
async function openExternalUrl(url: string): Promise<void> {
    if (isRunningInTauri()) {
        try {
            // Fallback to plugin-shell which is more reliable/common
            const { open } = await import('@tauri-apps/plugin-shell');
            await open(url);
        } catch (e) {
            console.error('Failed to open URL with Tauri shell:', e);
            // Fallback to standard window.open just in case
            window.open(url, '_blank');
        }
    } else {
        window.location.href = url;
    }
}

export interface SubscriptionStatus {
    hasSubscription: boolean;
    status: 'active' | 'canceled' | 'past_due' | 'inactive' | 'trialing' | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    loading: boolean;
    platform: 'stripe' | 'google_play' | 'apple' | null;
}

export interface GooglePlayPurchase {
    productId: string;
    purchaseToken: string;
    purchaseState: number;
    acknowledged: boolean;
}

export function useSubscription() {
    const [subscription, setSubscription] = useState<SubscriptionStatus>({
        hasSubscription: false,
        status: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        loading: true,
        platform: null,
    });

    // Check subscription from Supabase (works for all platforms after server validation)
    const checkSubscriptionFromDatabase = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                return {
                    hasSubscription: false,
                    status: null,
                    currentPeriodStart: null,
                    currentPeriodEnd: null,
                    cancelAtPeriodEnd: false,
                    platform: null,
                    isAuthenticated: false,
                };
            }

            const { data } = await supabase
                .from('subscriptions')
                .select('status, current_period_start, current_period_end, cancel_at_period_end, platform')
                .eq('user_id', user.id)
                .single();

            const isActive = data?.status === 'active' || data?.status === 'trialing';

            return {
                hasSubscription: isActive,
                status: data?.status || null,
                currentPeriodStart: data?.current_period_start || null,
                currentPeriodEnd: data?.current_period_end || null,
                cancelAtPeriodEnd: data?.cancel_at_period_end || false,
                platform: data?.platform || null,
                isAuthenticated: true,
            };
        } catch {
            return {
                hasSubscription: false,
                status: null,
                currentPeriodStart: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                platform: null,
                isAuthenticated: false,
            };
        }
    }, []);

    // Check Google Play purchases directly (for immediate feedback)
    const checkGooglePlayPurchases = useCallback(async (): Promise<GooglePlayPurchase[]> => {
        if (!isRunningInTauri()) return [];

        try {
            console.log('[IAP] Importing IAP plugin...');
            const { restorePurchases, initialize } = await import('@choochmeque/tauri-plugin-iap-api');

            console.log('[IAP] Initializing billing client...');
            await initialize();
            console.log('[IAP] Billing client initialized');

            console.log('[IAP] Restoring purchases...');
            const purchasesResult = await restorePurchases('subs');
            console.log('[IAP] restorePurchases raw response:', JSON.stringify(purchasesResult, null, 2));

            // restorePurchases returns { purchases: Purchase[] }
            const purchasesResponse = purchasesResult as unknown as { purchases?: GooglePlayPurchase[] };
            const purchases = purchasesResponse.purchases || [];
            console.log('[IAP] Purchases array length:', purchases.length);

            return purchases;
        } catch (error) {
            console.error('[IAP] Error checking Google Play purchases:', error);
            console.error('[IAP] Error type:', typeof error);
            console.error('[IAP] Error message:', error instanceof Error ? error.message : String(error));
            console.error('[IAP] Error stack:', error instanceof Error ? error.stack : 'N/A');
            return [];
        }
    }, []);

    const checkSubscription = useCallback(async () => {
        console.log('[Subscription] === CHECK START ===');
        setSubscription(prev => ({ ...prev, loading: true }));

        try {
            // First check database (authoritative source)
            console.log('[Subscription] Checking database...');
            const dbStatus = await checkSubscriptionFromDatabase();
            console.log('[Subscription] DB status:', JSON.stringify(dbStatus, null, 2));

            // Only check Google Play if user is authenticated and on Android/Tauri
            // and doesn't already have a subscription in DB
            const inTauri = isRunningInTauri();
            console.log('[Subscription] In Tauri:', inTauri);
            console.log('[Subscription] Has subscription in DB:', dbStatus.hasSubscription);
            console.log('[Subscription] Is authenticated:', dbStatus.isAuthenticated);

            if (inTauri && !dbStatus.hasSubscription && dbStatus.isAuthenticated) {
                console.log('[Subscription] Checking Google Play purchases...');
                try {
                    const purchases = await checkGooglePlayPurchases();
                    console.log('[Subscription] Google Play purchases:', JSON.stringify(purchases, null, 2));

                    const activePurchase = purchases.find(
                        p => p.productId === GOOGLE_PLAY_PRODUCT_ID && p.purchaseState === 0
                    );
                    console.log('[Subscription] Active purchase found:', activePurchase ? 'Yes' : 'No');

                    if (activePurchase) {
                        console.log('[Subscription] Setting subscription from Google Play purchase');
                        // User has an active purchase but it's not in DB yet
                        // This can happen if server webhook hasn't processed yet
                        setSubscription({
                            hasSubscription: true,
                            status: 'active',
                            currentPeriodStart: null,
                            currentPeriodEnd: null,
                            cancelAtPeriodEnd: false,
                            loading: false,
                            platform: 'google_play',
                        });
                        console.log('[Subscription] === CHECK COMPLETE (Google Play) ===');
                        return;
                    }
                } catch (iapError) {
                    console.error('[Subscription] IAP check error:', iapError);
                    console.error('[Subscription] IAP error type:', typeof iapError);
                    console.error('[Subscription] IAP error message:', iapError instanceof Error ? iapError.message : String(iapError));
                    // Continue with DB status even if IAP fails
                }
            }

            console.log('[Subscription] Setting subscription from DB');
            setSubscription({
                ...dbStatus,
                loading: false,
            } as SubscriptionStatus);
            console.log('[Subscription] === CHECK COMPLETE (DB) ===');
        } catch (error) {
            console.error('[Subscription] Check error:', error);
            console.error('[Subscription] Error type:', typeof error);
            console.error('[Subscription] Error message:', error instanceof Error ? error.message : String(error));
            // Ensure loading is false even on error
            setSubscription({
                hasSubscription: false,
                status: null,
                currentPeriodStart: null,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                loading: false,
                platform: null,
            });
        }
    }, [checkSubscriptionFromDatabase, checkGooglePlayPurchases]);

    useEffect(() => {
        checkSubscription();

        // Refresh automático quando o app voltar ao foco
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkSubscription();
            }
        };

        const handleFocus = () => {
            checkSubscription();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [checkSubscription]);

    // Purchase subscription via Google Play (Android/Tauri)
    const purchaseGooglePlay = useCallback(async () => {
        console.log('[IAP] === PURCHASE FLOW START ===');
        console.log('[IAP] Product ID:', GOOGLE_PLAY_PRODUCT_ID);

        if (!isRunningInTauri()) {
            console.error('[IAP] Not running in Tauri');
            throw new Error('Google Play purchases only available on Android');
        }

        try {
            console.log('[IAP] Importing IAP plugin for purchase...');
            const { initialize, getProducts, purchase, acknowledgePurchase } = await import('@choochmeque/tauri-plugin-iap-api');

            console.log('[IAP] Initializing billing client for purchase...');
            await initialize();
            console.log('[IAP] Billing client initialized for purchase');

            console.log('[IAP] Getting products for:', [GOOGLE_PLAY_PRODUCT_ID]);
            const productsResult = await getProducts([GOOGLE_PLAY_PRODUCT_ID], 'subs');
            console.log('[IAP] getProducts raw response:', JSON.stringify(productsResult, null, 2));

            // getProducts returns { products: Product[] }
            const productsResponse = productsResult as { products?: Array<{
                productId: string;
                subscriptionOfferDetails?: Array<{
                    offerToken: string;
                    basePlanId: string;
                }>;
            }> };

            const products = productsResponse.products || [];
            console.log('[IAP] Products array length:', products.length);

            if (products.length === 0) {
                console.error('[IAP] No products found! Product ID may not exist in Google Play Console');
                console.error('[IAP] Expected product ID:', GOOGLE_PLAY_PRODUCT_ID);
                throw new Error(`Produto "${GOOGLE_PLAY_PRODUCT_ID}" não encontrado no Google Play. Verifique se o produto foi criado no Google Play Console.`);
            }

            const product = products[0];
            console.log('[IAP] Found product:', product.productId);
            console.log('[IAP] Subscription offer details:', JSON.stringify(product.subscriptionOfferDetails, null, 2));

            // For subscriptions with base plans, we need the offerToken
            let offerToken: string | undefined;
            if (product.subscriptionOfferDetails && product.subscriptionOfferDetails.length > 0) {
                // Use the first offer (base plan)
                offerToken = product.subscriptionOfferDetails[0].offerToken;
                console.log('[IAP] Using offerToken:', offerToken);
                console.log('[IAP] basePlanId:', product.subscriptionOfferDetails[0].basePlanId);
            }

            console.log('[IAP] Starting purchase flow for:', GOOGLE_PLAY_PRODUCT_ID);
            const result = await purchase(GOOGLE_PLAY_PRODUCT_ID, 'subs', offerToken ? { offerToken } : undefined);
            console.log('[IAP] Purchase result:', JSON.stringify(result, null, 2));

            const purchaseResult = result as unknown as GooglePlayPurchase;

            if (purchaseResult && purchaseResult.purchaseToken) {
                console.log('[IAP] Purchase successful, acknowledging...');
                console.log('[IAP] Purchase token:', purchaseResult.purchaseToken);

                await acknowledgePurchase(purchaseResult.purchaseToken);
                console.log('[IAP] Purchase acknowledged');

                console.log('[IAP] Validating on server...');
                await validatePurchaseOnServer(purchaseResult);
                console.log('[IAP] Server validation complete');

                console.log('[IAP] Refreshing subscription status...');
                await checkSubscription();
                console.log('[IAP] === PURCHASE FLOW COMPLETE ===');

                return true;
            }

            console.warn('[IAP] Purchase result has no purchaseToken:', result);
            return false;
        } catch (error) {
            console.error('[IAP] === PURCHASE ERROR ===');
            console.error('[IAP] Error object:', error);
            console.error('[IAP] Error type:', typeof error);
            console.error('[IAP] Error message:', error instanceof Error ? error.message : String(error));
            console.error('[IAP] Error stack:', error instanceof Error ? error.stack : 'N/A');
            throw error;
        }
    }, [checkSubscription]);

    // Validate Google Play purchase on server
    const validatePurchaseOnServer = async (purchase: GooglePlayPurchase) => {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        const response = await fetch(getApiUrl('/api/iap/validate-google-play'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
                productId: purchase.productId,
                purchaseToken: purchase.purchaseToken,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to validate purchase on server');
        }

        return response.json();
    };

    // Restore purchases (Google Play)
    const restoreGooglePlayPurchases = useCallback(async () => {
        if (!isRunningInTauri()) return false;

        try {
            const purchases = await checkGooglePlayPurchases();

            for (const purchase of purchases) {
                if (purchase.productId === GOOGLE_PLAY_PRODUCT_ID && purchase.purchaseState === 0) {
                    await validatePurchaseOnServer(purchase);
                }
            }

            await checkSubscription();
            return true;
        } catch (error) {
            console.error('[IAP] Restore error:', error);
            return false;
        }
    }, [checkGooglePlayPurchases, checkSubscription]);

    // Create Stripe checkout session (Web)
    const createCheckoutSession = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            if (isRunningInTauri() && session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(getApiUrl('/api/stripe/create-checkout-session'), {
                method: 'POST',
                credentials: 'include',
                headers,
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.url) {
                await openExternalUrl(data.url);
            }
        } catch (error) {
            console.error('Erro ao criar checkout:', error);
            throw error;
        }
    }, []);

    // Open Stripe portal (Web)
    const openPortal = useCallback(async () => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };

            const inTauri = isRunningInTauri();
            const apiUrl = getApiUrl('/api/stripe/portal');

            if (inTauri && session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                credentials: 'include',
                headers,
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.url) {
                await openExternalUrl(data.url);
            }
        } catch (error) {
            console.error('Erro ao abrir portal:', error);
            throw error;
        }
    }, []);

    // Unified purchase function - uses correct platform automatically
    const subscribe = useCallback(async () => {
        if (isRunningInTauri()) {
            return purchaseGooglePlay();
        } else {
            return createCheckoutSession();
        }
    }, [purchaseGooglePlay, createCheckoutSession]);

    return {
        ...subscription,
        refresh: checkSubscription,
        subscribe,
        // Platform-specific methods
        purchaseGooglePlay,
        restoreGooglePlayPurchases,
        createCheckoutSession,
        openPortal,
        // Constants
        PRODUCT_ID: GOOGLE_PLAY_PRODUCT_ID,
    };
}

