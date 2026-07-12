/**
 * Logging utility for debugging
 */

export function logInfo(component: string, message: string, ...args: unknown[]) {
  console.log(`[${component}] ${message}`, ...args)
}

export function logError(component: string, message: string, error?: unknown) {
  console.error(`[${component}] ${message}`, error)
}

export function logWarn(component: string, message: string, ...args: unknown[]) {
  console.warn(`[${component}] ${message}`, ...args)
}

export function logDebug(component: string, message: string, ...args: unknown[]) {
  if (import.meta.dev) {
    console.log(`[${component}] ${message}`, ...args)
  }
}
