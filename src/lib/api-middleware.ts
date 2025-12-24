// ============================================
// API MIDDLEWARE
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateBody } from './validations'

/**
 * Standard API response type
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * Create an error response
 */
export function errorResponse(
  error: string,
  status = 400,
  code?: string
): NextResponse<ApiResponse> {
  console.error(`[API Error] ${code || 'UNKNOWN'}: ${error}`)
  return NextResponse.json({ success: false, error, code }, { status })
}

/**
 * Wrap an API handler with standard error handling
 */
export function withErrorHandler<T>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse<T | ApiResponse>> => {
    try {
      return await handler(req, context)
    } catch (error) {
      console.error('API Error:', error)

      if (error instanceof z.ZodError) {
        return errorResponse(
          error.issues.map((e: z.ZodIssue) => e.message).join(', '),
          400,
          'VALIDATION_ERROR'
        ) as NextResponse<T | ApiResponse>
      }

      if (error instanceof Error) {
        return errorResponse(error.message, 500, 'INTERNAL_ERROR') as NextResponse<T | ApiResponse>
      }

      return errorResponse('Erro desconhecido', 500) as NextResponse<T | ApiResponse>
    }
  }
}

/**
 * Validate request body and return parsed data or error response
 */
export async function parseBody<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse<ApiResponse> }> {
  try {
    const body = await req.json()
    const result = validateBody(schema, body)

    if (!result.success) {
      return {
        error: errorResponse(result.error, 400, 'VALIDATION_ERROR'),
      }
    }

    return { data: result.data }
  } catch {
    return {
      error: errorResponse('Body inválido', 400, 'INVALID_JSON'),
    }
  }
}

/**
 * Get query parameters as an object
 */
export function getQueryParams(req: NextRequest): Record<string, string> {
  const params: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return params
}

/**
 * Log API request (for debugging)
 */
export function logRequest(req: NextRequest, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${context || 'API'}] ${req.method} ${req.nextUrl.pathname}`)
  }
}
