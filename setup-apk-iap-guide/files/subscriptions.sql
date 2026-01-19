-- Tabela de assinaturas para uso da IA
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'canceled', 'past_due', 'inactive', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Politicas de seguranca
CREATE POLICY "Users can view own subscription" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions" ON subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- Indice para busca rapida
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Funcao para atualizar updated_at
CREATE OR REPLACE FUNCTION update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_updated_at();

-- Comentarios
COMMENT ON TABLE subscriptions IS 'Gerencia assinaturas para uso da IA via Stripe';
COMMENT ON COLUMN subscriptions.status IS 'Status da assinatura: active, canceled, past_due, inactive, trialing';
