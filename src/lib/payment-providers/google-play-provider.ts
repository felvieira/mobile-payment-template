// ============================================
// GOOGLE PLAY IAP PAYMENT PROVIDER
// ============================================

import { Order, Product } from '@prisma/client'
import { IPaymentProvider, CustomerInfo } from './base'
import { PaymentProvider, PaymentMethod, PaymentResult, WebhookResult, GooglePlayValidationResult } from '@/types'
import {
  validateGooglePlaySubscription,
  validateGooglePlayProduct,
  isGooglePlayConfigured,
} from '@/lib/google-play-validator'

export class GooglePlayProvider implements IPaymentProvider {
  readonly name: PaymentProvider = 'GOOGLE_PLAY'
  readonly supportedMethods: PaymentMethod[] = ['IN_APP_PURCHASE']

  isConfigured(): boolean {
    return isGooglePlayConfigured()
  }

  /**
   * Google Play purchases happen on-device, not server-initiated.
   * This registers the order after validation.
   */
  async createPayment(
    order: Order,
    product: Product | null,
    customerInfo: CustomerInfo
  ): Promise<PaymentResult> {
    return {
      success: true,
      orderId: order.id,
      provider: 'GOOGLE_PLAY',
      method: 'IN_APP_PURCHASE',
      amount: order.amount,
      currency: order.currency,
    }
  }

  /**
   * Handle Google Play Real-Time Developer Notifications (RTDN) via Pub/Sub
   */
  async handleWebhook(
    payload: string | object,
    signature?: string,
    headers?: Record<string, string>
  ): Promise<WebhookResult> {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload

    // RTDN comes as a Pub/Sub message with base64-encoded data
    const message = (data as Record<string, unknown>).message as Record<string, unknown> | undefined
    if (!message?.data) {
      return { success: false, error: 'Formato de notificação inválido' }
    }

    const decodedData = JSON.parse(
      Buffer.from(message.data as string, 'base64').toString('utf8')
    )

    const packageName = decodedData.packageName
    const subscriptionNotification = decodedData.subscriptionNotification
    const oneTimeProductNotification = decodedData.oneTimeProductNotification

    if (subscriptionNotification) {
      return this.handleSubscriptionNotification(
        packageName,
        subscriptionNotification
      )
    }

    if (oneTimeProductNotification) {
      return this.handleOneTimeProductNotification(
        packageName,
        oneTimeProductNotification
      )
    }

    return { success: true, message: 'Notificação ignorada' }
  }

  private async handleSubscriptionNotification(
    packageName: string,
    notification: { subscriptionId: string; purchaseToken: string; notificationType: number }
  ): Promise<WebhookResult> {
    // notificationType: 1=RECOVERED, 2=RENEWED, 3=CANCELED, 4=PURCHASED, etc.
    const { subscriptionId, purchaseToken, notificationType } = notification

    const validation = await validateGooglePlaySubscription(
      packageName,
      subscriptionId,
      purchaseToken
    )

    let newStatus: 'PAID' | 'FAILED' | undefined
    if (notificationType === 4 || notificationType === 2 || notificationType === 1) {
      // PURCHASED, RENEWED, RECOVERED
      newStatus = validation.valid ? 'PAID' : 'FAILED'
    } else if (notificationType === 3 || notificationType === 12 || notificationType === 13) {
      // CANCELED, REVOKED, EXPIRED
      newStatus = 'FAILED'
    }

    return {
      success: true,
      orderId: validation.orderId,
      newStatus,
      message: `Google Play subscription notification type: ${notificationType}`,
    }
  }

  private async handleOneTimeProductNotification(
    packageName: string,
    notification: { sku: string; purchaseToken: string; notificationType: number }
  ): Promise<WebhookResult> {
    const { sku, purchaseToken, notificationType } = notification

    const validation = await validateGooglePlayProduct(
      packageName,
      sku,
      purchaseToken
    )

    let newStatus: 'PAID' | 'FAILED' | undefined
    if (notificationType === 1) {
      // ONE_TIME_PRODUCT_PURCHASED
      newStatus = validation.valid ? 'PAID' : 'FAILED'
    } else if (notificationType === 2) {
      // ONE_TIME_PRODUCT_CANCELED
      newStatus = 'FAILED'
    }

    return {
      success: true,
      orderId: validation.orderId,
      newStatus,
      message: `Google Play one-time product notification type: ${notificationType}`,
    }
  }

  validateWebhookSignature(signature: string, payload: string): boolean {
    // Google Pub/Sub uses push authentication via service account verification
    // In production, verify the Pub/Sub push token
    return true
  }

  /**
   * Validate a purchase token (called from API route)
   */
  async validatePurchase(
    packageName: string,
    productId: string,
    purchaseToken: string,
    isSubscription: boolean = true
  ): Promise<GooglePlayValidationResult> {
    if (isSubscription) {
      return validateGooglePlaySubscription(packageName, productId, purchaseToken)
    }
    return validateGooglePlayProduct(packageName, productId, purchaseToken)
  }
}

/**
 * Singleton instance
 */
export const googlePlayProvider = new GooglePlayProvider()
