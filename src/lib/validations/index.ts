// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

import { z } from 'zod'

// ============================================
// COMMON SCHEMAS
// ============================================

export const emailSchema = z.string().email('Email inválido')

export const cpfSchema = z.string().regex(/^\d{11}$/, 'CPF deve ter 11 dígitos')

export const cnpjSchema = z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos')

export const taxIdSchema = z.string().refine(
  (val) => {
    const digits = val.replace(/\D/g, '')
    return digits.length === 11 || digits.length === 14
  },
  { message: 'CPF/CNPJ inválido' }
)

export const currencySchema = z.enum(['BRL', 'USD', 'EUR'])

export const amountSchema = z.number().positive('Valor deve ser positivo')

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const createPaymentSchema = z.object({
  productId: z.string().min(1, 'productId é obrigatório'),
  customerEmail: emailSchema,
  customerName: z.string().optional(),
  customerTaxId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>

export const pixPaymentSchema = createPaymentSchema.extend({
  customerPhone: z.string().optional(),
  customerTaxId: z.string().optional(), // CPF/CNPJ for PIX
})

export type PixPaymentInput = z.infer<typeof pixPaymentSchema>

export const mercadoPagoPaymentSchema = createPaymentSchema.extend({
  installments: z.number().min(1).max(12).optional(),
})

export type MercadoPagoPaymentInput = z.infer<typeof mercadoPagoPaymentSchema>

// ============================================
// QUICK PAYMENT SCHEMAS
// ============================================

export const createQuickPaymentSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  currency: z.enum(['BRL', 'USD', 'EUR']).default('BRL'),
  description: z.string().min(1, 'Descrição é obrigatória').max(500, 'Descrição muito longa'),
  customerEmail: emailSchema,
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerTaxId: z.string().optional(),
  paymentProvider: z.enum(['STRIPE', 'MERCADOPAGO', 'ABACATEPAY']),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateQuickPaymentSchemaInput = z.infer<typeof createQuickPaymentSchema>

// ============================================
// GOOGLE PLAY SCHEMAS
// ============================================

export const googlePlayValidationSchema = z.object({
  productId: z.string().min(1, 'productId é obrigatório'),
  purchaseToken: z.string().min(1, 'purchaseToken é obrigatório'),
  packageName: z.string().min(1, 'packageName é obrigatório'),
})

export type GooglePlayValidationInput = z.infer<typeof googlePlayValidationSchema>

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const createProductSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Nome muito longo'),
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  price: amountSchema,
  currency: currencySchema.default('BRL'),
  imageUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateProductInput = z.infer<typeof createProductSchema>

export const updateProductSchema = createProductSchema.partial()

export type UpdateProductInput = z.infer<typeof updateProductSchema>

// ============================================
// ORDER SCHEMAS
// ============================================

export const orderStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED'])

export const orderFiltersSchema = z.object({
  status: orderStatusSchema.optional(),
  email: z.string().optional(),
  provider: z.enum(['STRIPE', 'MERCADOPAGO', 'ABACATEPAY', 'GOOGLE_PLAY']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export type OrderFilters = z.infer<typeof orderFiltersSchema>

// ============================================
// WEBHOOK SCHEMAS
// ============================================

export const stripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
})

export const mercadoPagoWebhookSchema = z.object({
  type: z.string().optional(),
  action: z.string().optional(),
  data: z.object({
    id: z.string().optional(),
  }).optional(),
})

export const pixWebhookSchema = z.object({
  data: z.object({
    id: z.string(),
    status: z.string(),
    externalId: z.string().optional(),
  }).optional(),
  status: z.string().optional(),
  externalId: z.string().optional(),
})

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate request body with a Zod schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): {
  success: true
  data: T
} | {
  success: false
  error: string
  details: z.ZodIssue[]
} {
  const result = schema.safeParse(body)

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: z.ZodIssue) => e.message).join(', '),
      details: result.error.issues,
    }
  }

  return {
    success: true,
    data: result.data,
  }
}

/**
 * Parse and validate query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, params: URLSearchParams): {
  success: true
  data: T
} | {
  success: false
  error: string
} {
  const obj: Record<string, string> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })

  const result = schema.safeParse(obj)

  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e: z.ZodIssue) => `${e.path}: ${e.message}`).join(', '),
    }
  }

  return {
    success: true,
    data: result.data,
  }
}
