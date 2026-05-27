/**
 * Utility di logging per debugging
 */

export function logInfo(component: string, message: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(`[${component}] ${message}`, ...args)
}

export function logError(component: string, message: string, error?: any) {
  // eslint-disable-next-line no-console
  console.error(`[${component}] ${message}`, error)
}

export function logWarn(component: string, message: string, ...args: any[]) {
  // eslint-disable-next-line no-console
  console.warn(`[${component}] ${message}`, ...args)
}

export function logDebug(component: string, message: string, ...args: any[]) {
  if (import.meta.dev) {
    // eslint-disable-next-line no-console
    console.log(`[${component}] ${message}`, ...args)
  }
}
