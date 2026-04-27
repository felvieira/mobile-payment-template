import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import type { PaymentAdapter, CheckoutInput, CheckoutResult, WebhookVerification, SubscriptionStatus } from './types'
import crypto from 'crypto'

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! })

export const mercadopagoAdapter: PaymentAdapter = {
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const preapproval = new PreApproval(client)
    const result = await preapproval.create({
      body: {
        preapproval_plan_id: input.planId,
        payer_email: input.customerEmail,
        back_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
        external_reference: input.userId,
      }
    })
    return { redirectUrl: result.init_point!, providerSubId: String(result.id) }
  },

  async verifyWebhook(req: Request): Promise<WebhookVerification> {
    // MercadoPago sends x-signature header
    const sig = req.headers.get('x-signature') ?? ''
    const tsMatch = sig.match(/ts=(\d+)/)
    const v1Match = sig.match(/v1=([a-f0-9]+)/)
    if (!tsMatch || !v1Match) return { valid: false, event: null }
    const body = await req.text()
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET ?? ''
    const hash = crypto.createHmac('sha256', secret).update(`${tsMatch[1]};${body}`).digest('hex')
    return { valid: hash === v1Match[1], event: JSON.parse(body) }
  },

  async getStatus(providerSubId: string): Promise<SubscriptionStatus> {
    const preapproval = new PreApproval(client)
    const result = await preapproval.get({ id: providerSubId })
    const status = result.status === 'authorized' ? 'active' : 'canceled'
    return { status }
  },
}
