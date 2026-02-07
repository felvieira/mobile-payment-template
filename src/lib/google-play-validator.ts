// ============================================
// GOOGLE PLAY IAP VALIDATOR
// ============================================

import { GoogleAuth } from 'google-auth-library'
import { GooglePlayValidationResult, PaymentError } from '@/types'

const GOOGLE_PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3'

/**
 * Get authenticated Google client using service account credentials
 */
function getGoogleAuth(): GoogleAuth {
  const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) {
    throw new PaymentError(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON não configurado',
      'CONFIGURATION_ERROR',
      'GOOGLE_PLAY'
    )
  }

  const credentials = JSON.parse(serviceAccountJson)

  return new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
}

/**
 * Validate a Google Play subscription purchase
 */
export async function validateGooglePlaySubscription(
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<GooglePlayValidationResult> {
  const auth = getGoogleAuth()
  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()

  const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      valid: false,
      productId,
      purchaseToken,
      packageName,
      rawResponse: { error: errorText, status: response.status },
    }
  }

  const data = await response.json()

  // paymentState: 0 = pending, 1 = received, 2 = free trial, 3 = deferred
  const isValid = data.paymentState === 1 || data.paymentState === 2

  return {
    valid: isValid,
    orderId: data.orderId,
    productId,
    purchaseToken,
    packageName,
    expiryTime: data.expiryTimeMillis
      ? new Date(parseInt(data.expiryTimeMillis)).toISOString()
      : undefined,
    paymentState: data.paymentState,
    acknowledgementState: data.acknowledgementState,
    rawResponse: data,
  }
}

/**
 * Validate a Google Play one-time product purchase
 */
export async function validateGooglePlayProduct(
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<GooglePlayValidationResult> {
  const auth = getGoogleAuth()
  const client = await auth.getClient()
  const accessToken = await client.getAccessToken()

  const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      valid: false,
      productId,
      purchaseToken,
      packageName,
      rawResponse: { error: errorText, status: response.status },
    }
  }

  const data = await response.json()

  // purchaseState: 0 = purchased, 1 = canceled, 2 = pending
  const isValid = data.purchaseState === 0

  return {
    valid: isValid,
    orderId: data.orderId,
    productId,
    purchaseToken,
    packageName,
    paymentState: data.purchaseState,
    acknowledgementState: data.acknowledgementState,
    rawResponse: data,
  }
}

/**
 * Check if Google Play integration is configured
 */
export function isGooglePlayConfigured(): boolean {
  return !!(
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON &&
    process.env.GOOGLE_PLAY_PACKAGE_NAME
  )
}
