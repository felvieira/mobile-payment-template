import { GoogleAuth } from 'google-auth-library';

interface GooglePlaySubscription {
    kind: string;
    startTimeMillis: string;
    expiryTimeMillis: string;
    autoRenewing: boolean;
    priceCurrencyCode: string;
    priceAmountMicros: string;
    countryCode: string;
    paymentState: number; // 0 = pending, 1 = received, 2 = free trial
    cancelReason?: number; // 0 = user, 1 = system, 2 = replaced, 3 = developer
    userCancellationTimeMillis?: string;
    orderId: string;
    linkedPurchaseToken?: string;
    purchaseType?: number;
    acknowledgementState?: number;
}

export interface ValidatedSubscription {
    isValid: boolean;
    expiryDate: Date;
    autoRenewing: boolean;
    cancelReason?: string;
    paymentState: 'pending' | 'received' | 'free_trial' | 'unknown';
    orderId: string;
    error?: string;
}

export async function validateGooglePlaySubscription(
    packageName: string,
    subscriptionId: string,
    purchaseToken: string
): Promise<ValidatedSubscription> {
    try {
        // Check if credentials are configured
        const credentials = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
        if (!credentials) {
            console.warn('[Google Play] Service account credentials not configured');
            return {
                isValid: false,
                expiryDate: new Date(),
                autoRenewing: false,
                paymentState: 'unknown',
                orderId: '',
                error: 'Service account not configured'
            };
        }

        // Parse service account JSON with robust handling for Docker/VPS env vars
        let parsedCredentials;
        try {
            let cleanCredentials = credentials.trim();

            // Remove BOM and invisible characters
            cleanCredentials = cleanCredentials.replace(/^﻿/, '');

            // Remove wrapping single quotes (e.g. GOOGLE_PLAY_SERVICE_ACCOUNT_JSON='{"type":...}')
            if (cleanCredentials.startsWith("'") && cleanCredentials.endsWith("'")) {
                cleanCredentials = cleanCredentials.slice(1, -1);
            }

            // Remove wrapping double quotes with escaped internals
            if (cleanCredentials.startsWith('"') && cleanCredentials.endsWith('"')) {
                try {
                    cleanCredentials = JSON.parse(cleanCredentials);
                } catch {
                    cleanCredentials = cleanCredentials.slice(1, -1);
                }
            }

            if (typeof cleanCredentials === 'string') {
                // Replace literal \\n with actual \n (some env parsers double-escape)
                cleanCredentials = cleanCredentials.replace(/\\\\n/g, '\\n');

                // Extract JSON object between first { and last }
                const jsonStart = cleanCredentials.indexOf('{');
                const jsonEnd = cleanCredentials.lastIndexOf('}');
                if (jsonStart >= 0 && jsonEnd > jsonStart) {
                    if (jsonStart > 0) {
                        console.warn('[Google Play] Trimming prefix of', jsonStart, 'chars');
                    }
                    cleanCredentials = cleanCredentials.substring(jsonStart, jsonEnd + 1);
                }

                // Unescape Docker/shell escaped quotes: \" → "
                cleanCredentials = cleanCredentials.replace(/\\"/g, '"');
                // Unescape escaped single quotes: \' → '
                cleanCredentials = cleanCredentials.replace(/\\'/g, "'");
                // Fix double-escaped newlines: \\n → \n
                cleanCredentials = cleanCredentials.replace(/\\\\n/g, '\\n');

                console.log('[Google Play] Cleaned credentials first 80 chars:', cleanCredentials.substring(0, 80));

                parsedCredentials = JSON.parse(cleanCredentials);
            } else {
                parsedCredentials = cleanCredentials;
            }

            // Validate minimum required fields
            if (!parsedCredentials?.client_email || !parsedCredentials?.private_key) {
                throw new Error('Missing required fields: client_email or private_key');
            }
        } catch (parseError) {
            console.error('[Google Play] Failed to parse service account JSON:', parseError instanceof Error ? parseError.message : parseError);
            console.error('[Google Play] Credentials length:', credentials.length);
            console.error('[Google Play] First 5 char codes:', Array.from(credentials.substring(0, 5)).map(c => c.charCodeAt(0)));
            console.error('[Google Play] Credentials first 100 chars:', credentials.substring(0, 100));
            return {
                isValid: false,
                expiryDate: new Date(),
                autoRenewing: false,
                paymentState: 'unknown',
                orderId: '',
                error: 'Service account credentials not configured'
            };
        }

        // Initialize Google Auth
        const auth = new GoogleAuth({
            credentials: parsedCredentials,
            scopes: ['https://www.googleapis.com/auth/androidpublisher'],
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        if (!accessToken.token) {
            throw new Error('Failed to get access token');
        }

        // Call Google Play Developer API
        const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${subscriptionId}/tokens/${purchaseToken}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Google Play] API error:', response.status, errorText);

            if (response.status === 410) {
                // Subscription not found or expired
                return {
                    isValid: false,
                    expiryDate: new Date(),
                    autoRenewing: false,
                    paymentState: 'unknown',
                    orderId: '',
                    error: 'Subscription not found or expired'
                };
            }

            throw new Error(`Google Play API error: ${response.status}`);
        }

        const data: GooglePlaySubscription = await response.json();

        const expiryDate = new Date(parseInt(data.expiryTimeMillis));
        const now = new Date();
        const isValid = expiryDate > now && data.paymentState === 1;

        let cancelReason: string | undefined;
        if (data.cancelReason !== undefined) {
            const reasons = ['user', 'system', 'replaced', 'developer'];
            cancelReason = reasons[data.cancelReason] || 'unknown';
        }

        const paymentStates = ['pending', 'received', 'free_trial'];
        const paymentState = paymentStates[data.paymentState] || 'unknown';

        return {
            isValid,
            expiryDate,
            autoRenewing: data.autoRenewing,
            cancelReason,
            paymentState: paymentState as ValidatedSubscription['paymentState'],
            orderId: data.orderId,
        };

    } catch (error) {
        console.error('[Google Play] Validation error:', error);
        return {
            isValid: false,
            expiryDate: new Date(),
            autoRenewing: false,
            paymentState: 'unknown',
            orderId: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
