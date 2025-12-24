// ============================================
// STRUCTURED LOGGING
// ============================================

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string
  level: LogLevel
  context: string
  message: string
  data?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
  requestId?: string
  duration?: number
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel
  /** Whether to output as JSON */
  json: boolean
  /** Whether to include timestamps */
  timestamps: boolean
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Default configuration based on environment
 */
const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  json: process.env.NODE_ENV === 'production',
  timestamps: true,
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry, config: LoggerConfig): string {
  if (config.json) {
    return JSON.stringify(entry)
  }

  // Human-readable format for development
  const parts: string[] = []

  if (config.timestamps) {
    parts.push(`[${entry.timestamp}]`)
  }

  parts.push(`[${entry.level.toUpperCase()}]`)
  parts.push(`[${entry.context}]`)
  parts.push(entry.message)

  if (entry.requestId) {
    parts.push(`(req:${entry.requestId.slice(0, 8)})`)
  }

  if (entry.duration !== undefined) {
    parts.push(`(${entry.duration}ms)`)
  }

  let output = parts.join(' ')

  if (entry.data && Object.keys(entry.data).length > 0) {
    output += '\n  Data: ' + JSON.stringify(entry.data, null, 2).replace(/\n/g, '\n  ')
  }

  if (entry.error) {
    output += `\n  Error: ${entry.error.name}: ${entry.error.message}`
    if (entry.error.stack && process.env.NODE_ENV !== 'production') {
      output += `\n  Stack: ${entry.error.stack}`
    }
  }

  return output
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string, config: Partial<LoggerConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config }

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[finalConfig.minLevel]
  }

  function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    }

    const formatted = formatLogEntry(entry, finalConfig)

    switch (level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }

  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, error?: Error, data?: Record<string, unknown>) => {
      if (!shouldLog('error')) return

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        context,
        message,
        data,
        error: error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
      }

      console.error(formatLogEntry(entry, finalConfig))
    },

    /**
     * Log with request context
     */
    withRequest: (requestId: string) => ({
      debug: (message: string, data?: Record<string, unknown>) => {
        if (!shouldLog('debug')) return
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'debug',
          context,
          message,
          data,
          requestId,
        }
        console.debug(formatLogEntry(entry, finalConfig))
      },
      info: (message: string, data?: Record<string, unknown>) => {
        if (!shouldLog('info')) return
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          context,
          message,
          data,
          requestId,
        }
        console.info(formatLogEntry(entry, finalConfig))
      },
      warn: (message: string, data?: Record<string, unknown>) => {
        if (!shouldLog('warn')) return
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'warn',
          context,
          message,
          data,
          requestId,
        }
        console.warn(formatLogEntry(entry, finalConfig))
      },
      error: (message: string, error?: Error, data?: Record<string, unknown>) => {
        if (!shouldLog('error')) return
        const entry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'error',
          context,
          message,
          data,
          requestId,
          error: error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : undefined,
        }
        console.error(formatLogEntry(entry, finalConfig))
      },
    }),

    /**
     * Time an operation
     */
    time: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
      const start = Date.now()
      try {
        const result = await fn()
        const duration = Date.now() - start
        log('debug', `${operation} completed`, { duration })
        return result
      } catch (error) {
        const duration = Date.now() - start
        if (error instanceof Error) {
          const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'error',
            context,
            message: `${operation} failed`,
            duration,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
          console.error(formatLogEntry(entry, finalConfig))
        }
        throw error
      }
    },
  }
}

/**
 * Pre-configured loggers for different contexts
 */
export const logger = {
  api: createLogger('API'),
  payment: createLogger('Payment'),
  webhook: createLogger('Webhook'),
  db: createLogger('Database'),
  auth: createLogger('Auth'),
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
