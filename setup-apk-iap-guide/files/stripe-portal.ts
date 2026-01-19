import { NextRequest, NextResponse } from 'next/server';
import { stripe, getURL } from '@/lib/stripe';
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
                    { error: 'Nao autenticado.' },
                    { status: 401 }
                )
            );
        }

        // Usar admin client para operações no banco
        const supabase = createAdminClient();

        // Buscar customer_id
        const { data: subData } = await supabase
            .from('subscriptions')
            .select('stripe_customer_id')
            .eq('user_id', user.id)
            .single();

        if (!subData?.stripe_customer_id) {
            return withCors(
                request,
                NextResponse.json(
                    { error: 'Nenhuma assinatura encontrada.' },
                    { status: 404 }
                )
            );
        }

        // Definir URL de retorno
        const returnUrl = isTauri
            ? `${DEEP_LINK_SCHEME}://settings/subscription`
            : `${getURL()}settings/subscription`;

        // Criar sessao do portal
        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subData.stripe_customer_id,
            return_url: returnUrl,
        });

        return withCors(request, NextResponse.json({ url: portalSession.url }));
    } catch (error) {
        console.error('Erro ao criar portal session:', error);
        return withCors(
            request,
            NextResponse.json(
                { error: 'Erro ao criar portal de gerenciamento.' },
                { status: 500 }
            )
        );
    }
}
