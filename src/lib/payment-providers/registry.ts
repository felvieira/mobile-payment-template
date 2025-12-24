// ============================================
// PAYMENT PROVIDER REGISTRY
// ============================================

import { IPaymentProvider } from './base'
import { PaymentProvider, PaymentMethod, PaymentError } from '@/types'

/**
 * Registry for payment providers.
 * Allows dynamic registration and lookup of providers.
 */
class PaymentProviderRegistry {
  private providers = new Map<PaymentProvider, IPaymentProvider>()

  /**
   * Register a new payment provider
   */
  register(provider: IPaymentProvider): void {
    if (this.providers.has(provider.name)) {
      console.warn(`Provider ${provider.name} is being re-registered`)
    }
    this.providers.set(provider.name, provider)
    console.log(`Payment provider registered: ${provider.name}`)
  }

  /**
   * Get a provider by name
   */
  get(name: PaymentProvider): IPaymentProvider {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new PaymentError(
        `Payment provider not found: ${name}`,
        'CONFIGURATION_ERROR'
      )
    }
    return provider
  }

  /**
   * Get a provider by name (nullable)
   */
  getOrNull(name: PaymentProvider): IPaymentProvider | null {
    return this.providers.get(name) || null
  }

  /**
   * Check if a provider is registered
   */
  has(name: PaymentProvider): boolean {
    return this.providers.has(name)
  }

  /**
   * Get all registered providers
   */
  getAll(): IPaymentProvider[] {
    return Array.from(this.providers.values())
  }

  /**
   * Get all configured providers (with valid API keys)
   */
  getConfigured(): IPaymentProvider[] {
    return this.getAll().filter(p => p.isConfigured())
  }

  /**
   * Find providers that support a specific payment method
   */
  findByMethod(method: PaymentMethod): IPaymentProvider[] {
    return this.getConfigured().filter(p => p.supportedMethods.includes(method))
  }

  /**
   * Get available payment methods based on configured providers
   */
  getAvailableMethods(): PaymentMethod[] {
    const methods = new Set<PaymentMethod>()
    for (const provider of this.getConfigured()) {
      for (const method of provider.supportedMethods) {
        methods.add(method)
      }
    }
    return Array.from(methods)
  }

  /**
   * Clear all providers (useful for testing)
   */
  clear(): void {
    this.providers.clear()
  }
}

/**
 * Global payment provider registry instance
 */
export const paymentProviderRegistry = new PaymentProviderRegistry()
