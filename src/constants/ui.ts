// ============================================
// UI CONSTANTS
// ============================================

import {
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  QrCode,
  Barcode,
  Smartphone,
  LucideIcon,
} from 'lucide-react'
import { OrderStatus, PaymentMethod, PaymentProvider } from '@/types'

/**
 * Status badge configuration
 */
export interface StatusConfig {
  label: string
  icon: LucideIcon
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
}

export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  PAID: {
    label: 'Pago',
    icon: CheckCircle,
    variant: 'default',
    className: 'border-green-500 text-green-700 bg-green-50',
  },
  PENDING: {
    label: 'Pendente',
    icon: Clock,
    variant: 'secondary',
    className: 'border-yellow-500 text-yellow-700 bg-yellow-50',
  },
  FAILED: {
    label: 'Falhou',
    icon: XCircle,
    variant: 'destructive',
    className: 'border-red-500 text-red-700 bg-red-50',
  },
  REFUNDED: {
    label: 'Reembolsado',
    icon: RefreshCw,
    variant: 'outline',
    className: 'border-blue-500 text-blue-700 bg-blue-50',
  },
  EXPIRED: {
    label: 'Expirado',
    icon: AlertTriangle,
    variant: 'outline',
    className: 'border-gray-500 text-gray-700 bg-gray-50',
  },
}

/**
 * Provider configuration for UI
 */
export interface ProviderConfig {
  label: string
  icon: LucideIcon
  color: string
}

export const PROVIDER_CONFIG: Record<PaymentProvider, ProviderConfig> = {
  STRIPE: {
    label: 'Stripe',
    icon: CreditCard,
    color: '#635BFF',
  },
  MERCADOPAGO: {
    label: 'Mercado Pago',
    icon: CreditCard,
    color: '#009EE3',
  },
  ABACATEPAY: {
    label: 'PIX',
    icon: QrCode,
    color: '#32BCAD',
  },
  GOOGLE_PLAY: {
    label: 'Google Play',
    icon: Smartphone,
    color: '#01875F',
  },
}

/**
 * Payment method icons
 */
export const METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: CreditCard,
  PIX: QrCode,
  BOLETO: Barcode,
  IN_APP_PURCHASE: Smartphone,
}
