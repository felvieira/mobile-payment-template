export interface CheckoutInput {
  userId: string
  customerEmail: string
  planId: string
}

export interface CheckoutResult {
  redirectUrl?: string
  brCode?: string
  brCodeBase64?: string
  paymentRef?: string
  providerSubId: string
  expiresAt?: Date
}

export interface WebhookVerification {
  valid: boolean
  event: unknown
}

export interface SubscriptionStatus {
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'expired'
  currentPeriodEnd?: Date
}

export interface PaymentAdapter {
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>
  verifyWebhook(req: Request): Promise<WebhookVerification>
  getStatus(providerSubId: string): Promise<SubscriptionStatus>
}
