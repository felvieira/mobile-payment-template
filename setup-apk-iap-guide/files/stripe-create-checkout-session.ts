import { NextRequest, NextResponse } from 'next/server';
import { stripe, AI_SUBSCRIPTION_PRICE_ID, getURL } from '@/lib/stripe';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { withCors, handleCorsPreflightRequest } from '@/lib/cors';

// Constante para o deep link scheme do app
const DEEP_LINK_SCHEME = 'com.memrapp.bible';

// Handler para requisições OPTIONS (CORS preflight)
export async function OPTIONS(request: NextRequest) {
    return handleCorsPreflightRequest(request);
}

export async function POST(request: NextRequest) {
    try {
        let user = null;
        let isTauri = false;

        // Primeiro tenta via Authorization header (para Tauri/APK)
        const authHeader = request.headers.get('authorization');
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const supabaseAdmin = createAdminClient();
            const { data: { user: tokenUser }, error } = await supabaseAdmin.auth.getUser(token);
            if (!error && tokenUser) {
                user = tokenUser;
                // Se veio com Authorization header, provavelmente é Tauri
                isTauri = true;
            }
        }

        // Se não encontrou via header, tenta via cookies (para web)
        if (!user) {
            const supabase = await createClient();
            const { data: { user: cookieUser } } = await supabase.auth.getUser();
            user = cookieUser;
        }

        if (!user) {
            return withCors(
                request,
                NextResponse.json(
                    { error: 'Nao autenticado. Faca login primeiro.' },
                    { status: 401 }
                )
            );
        }

        // Usar admin client para operações no banco
        const supabase = createAdminClient();

        // Verificar se ja tem assinatura ativa
        const { data: existingSub } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .single();

        if (existingSub) {
            return withCors(
                request,
                NextResponse.json(
                    { error: 'Voce ja possui uma assinatura ativa.' },
                    { status: 400 }
                )
            );
        }

        // Buscar ou criar customer no Stripe
        let stripeCustomerId: string;

        const { data: subData } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        if (subData?.stripe_customer_id) {
            stripeCustomerId = subData.stripe_customer_id;
        } else {
            // Criar novo customer
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id,
                },
            });
            stripeCustomerId = customer.id;

            // Salvar customer_id
            await supabase.from('subscriptions').upsert({
                user_id: user.id,
                stripe_customer_id: stripeCustomerId,
                status: 'inactive',
            });
        }

        // Definir URLs de sucesso e cancelamento
        // Para Tauri/APK, usar deep links para voltar ao app automaticamente
        const successUrl = isTauri
            ? `${DEEP_LINK_SCHEME}://settings/subscription?subscription=success`
            : `${getURL()}settings/subscription?subscription=success`;
        const cancelUrl = isTauri
            ? `${DEEP_LINK_SCHEME}://settings/subscription?subscription=canceled`
            : `${getURL()}settings/subscription?subscription=canceled`;

        // Criar sessao de checkout
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: AI_SUBSCRIPTION_PRICE_ID,
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
            subscription_data: {
                metadata: {
                    supabase_user_id: user.id,
                },
            },
            allow_promotion_codes: true,
            billing_address_collection: 'auto',
        });

        return withCors(request, NextResponse.json({ url: session.url }));
    } catch (error) {
        console.error('Erro ao criar checkout session:', error);
        return withCors(
            request,
            NextResponse.json(
                { error: 'Erro ao criar sessao de pagamento.' },
                { status: 500 }
            )
        );
    }
}
