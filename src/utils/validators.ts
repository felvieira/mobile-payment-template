// ============================================
// VALIDATORS
// ============================================

import { SUPPORTED_CURRENCIES } from '@/constants'

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate CPF (Brazilian individual tax ID)
 */
export function isValidCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')

  if (digits.length !== 11) return false
  if (/^(\d)\1+$/.test(digits)) return false // All same digits

  // Validate check digits
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(digits[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(digits[10])) return false

  return true
}

/**
 * Validate CNPJ (Brazilian company tax ID)
 */
export function isValidCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')

  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false

  // Validate check digits
  let size = digits.length - 2
  let numbers = digits.substring(0, size)
  const checkDigits = digits.substring(size)
  let sum = 0
  let pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(checkDigits.charAt(0))) return false

  size = size + 1
  numbers = digits.substring(0, size)
  sum = 0
  pos = size - 7

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(checkDigits.charAt(1))) return false

  return true
}

/**
 * Validate tax ID (CPF or CNPJ)
 */
export function isValidTaxId(taxId: string): boolean {
  const digits = taxId.replace(/\D/g, '')
  if (digits.length === 11) return isValidCPF(digits)
  if (digits.length === 14) return isValidCNPJ(digits)
  return false
}

/**
 * Validate currency code
 */
export function isValidCurrency(currency: string): boolean {
  return SUPPORTED_CURRENCIES.includes(currency as typeof SUPPORTED_CURRENCIES[number])
}

/**
 * Validate positive amount
 */
export function isValidAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && Number.isFinite(amount)
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential XSS characters
    .slice(0, 1000) // Limit length
}

/**
 * Validate create payment input
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateCreatePaymentInput(input: {
  productId?: string
  customerEmail?: string
  customerName?: string
  customerTaxId?: string
}): ValidationResult {
  const errors: string[] = []

  if (!input.productId) {
    errors.push('productId é obrigatório')
  }

  if (!input.customerEmail) {
    errors.push('customerEmail é obrigatório')
  } else if (!isValidEmail(input.customerEmail)) {
    errors.push('Email inválido')
  }

  if (input.customerTaxId && !isValidTaxId(input.customerTaxId)) {
    errors.push('CPF/CNPJ inválido')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
