// ============================================
// FORMATTERS
// ============================================

/**
 * Format amount in cents to currency string
 */
export function formatCurrency(
  cents: number,
  currency: string = 'BRL',
  locale: string = 'pt-BR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/**
 * Convert cents to decimal (for providers that expect reais)
 */
export function centsToDecimal(cents: number): number {
  return cents / 100
}

/**
 * Convert decimal to cents
 */
export function decimalToCents(decimal: number): number {
  return Math.round(decimal * 100)
}

/**
 * Format date to locale string
 */
export function formatDate(
  date: Date | string,
  locale: string = 'pt-BR',
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(locale, options)
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string,
  locale: string = 'pt-BR'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

/**
 * Format CPF (Brazilian individual tax ID)
 * Input: 12345678901
 * Output: 123.456.789-01
 */
export function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '')
  if (digits.length !== 11) return cpf
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

/**
 * Format CNPJ (Brazilian company tax ID)
 * Input: 12345678901234
 * Output: 12.345.678/9012-34
 */
export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
}

/**
 * Format tax ID (CPF or CNPJ) automatically based on length
 */
export function formatTaxId(taxId: string): string {
  const digits = taxId.replace(/\D/g, '')
  if (digits.length === 11) return formatCPF(digits)
  if (digits.length === 14) return formatCNPJ(digits)
  return taxId
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Format order ID for display (short version)
 */
export function formatOrderId(id: string, length: number = 8): string {
  return id.slice(0, length) + '...'
}
