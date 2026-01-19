import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
    if (!_stripe) {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY is not defined');
        }
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2025-12-15.clover',
            typescript: true,
        });
    }
    return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
    get(_target, prop) {
        const client = getStripeClient();
        const value = client[prop as keyof Stripe];
        if (typeof value === 'function') {
            return value.bind(client);
        }
        return value;
    },
});

export function getAISubscriptionPriceId(): string {
    if (!process.env.STRIPE_AI_PRICE_ID) {
        throw new Error('STRIPE_AI_PRICE_ID is not defined');
    }
    return process.env.STRIPE_AI_PRICE_ID;
}

export const AI_SUBSCRIPTION_PRICE_ID = process.env.STRIPE_AI_PRICE_ID!;

export const getURL = () => {
    let url =
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.NEXT_PUBLIC_VERCEL_URL ??
        'http://localhost:3000';

    url = url.includes('http') ? url : `https://${url}`;
    url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;

    return url;
};
