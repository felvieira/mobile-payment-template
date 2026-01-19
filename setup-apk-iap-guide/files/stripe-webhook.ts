import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Helper para extrair periodo da subscription
function getSubscriptionPeriod(subscription: Stripe.Subscription) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = subscription as any;
    return {
        start: sub.current_period_start || sub.start_date,
        end: sub.current_period_end || sub.ended_at,
    };
}

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json(
            { error: 'Webhook signature verification failed' },
            { status: 400 }
        );
    }

    const supabase = createAdminClient();

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                if (session.mode === 'subscription' && session.subscription) {
                    const subscriptionId = typeof session.subscription === 'string'
                        ? session.subscription
                        : session.subscription.id;

                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const userId = subscription.metadata.supabase_user_id;
                    const period = getSubscriptionPeriod(subscription);

                    if (userId) {
                        await supabase.from('subscriptions').upsert({
                            user_id: userId,
                            stripe_customer_id: session.customer as string,
                            stripe_subscription_id: subscription.id,
                            stripe_price_id: subscription.items.data[0].price.id,
                            status: 'active',
                            current_period_start: period.start ? new Date(period.start * 1000).toISOString() : null,
                            current_period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
                            cancel_at_period_end: subscription.cancel_at_period_end,
                        });
                    }
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata.supabase_user_id;
                const period = getSubscriptionPeriod(subscription);

                if (userId) {
                    const status = subscription.status === 'active' ? 'active'
                        : subscription.status === 'past_due' ? 'past_due'
                        : subscription.status === 'canceled' ? 'canceled'
                        : subscription.status === 'trialing' ? 'trialing'
                        : 'inactive';

                    await supabase.from('subscriptions').upsert({
                        user_id: userId,
                        stripe_subscription_id: subscription.id,
                        stripe_price_id: subscription.items.data[0].price.id,
                        status,
                        current_period_start: period.start ? new Date(period.start * 1000).toISOString() : null,
                        current_period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
                        cancel_at_period_end: subscription.cancel_at_period_end,
                    });
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata.supabase_user_id;

                if (userId) {
                    await supabase.from('subscriptions').update({
                        status: 'canceled',
                        cancel_at_period_end: false,
                    }).eq('stripe_subscription_id', subscription.id);
                }
                break;
            }

            case 'invoice.payment_failed': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invoice = event.data.object as any;
                if (invoice.subscription) {
                    const subscriptionId = typeof invoice.subscription === 'string'
                        ? invoice.subscription
                        : invoice.subscription.id;

                    await supabase.from('subscriptions').update({
                        status: 'past_due',
                    }).eq('stripe_subscription_id', subscriptionId);
                }
                break;
            }

            case 'invoice.payment_succeeded': {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invoice = event.data.object as any;
                if (invoice.subscription && invoice.billing_reason === 'subscription_cycle') {
                    const subscriptionId = typeof invoice.subscription === 'string'
                        ? invoice.subscription
                        : invoice.subscription.id;

                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const period = getSubscriptionPeriod(subscription);

                    await supabase.from('subscriptions').update({
                        status: 'active',
                        current_period_start: period.start ? new Date(period.start * 1000).toISOString() : null,
                        current_period_end: period.end ? new Date(period.end * 1000).toISOString() : null,
                    }).eq('stripe_subscription_id', subscriptionId);
                }
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json(
            { error: 'Error processing webhook' },
            { status: 500 }
        );
    }
}
