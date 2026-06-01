/**
 * Utility di logging per debugging
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logInfo(component: string, message: string, ...args: any[]) {
  console.log(`[${component}] ${message}`, ...args)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logError(component: string, message: string, error?: any) {
  console.error(`[${component}] ${message}`, error)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logWarn(component: string, message: string, ...args: any[]) {
  console.warn(`[${component}] ${message}`, ...args)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function logDebug(component: string, message: string, ...args: any[]) {
  if (import.meta.dev) {
    console.log(`[${component}] ${message}`, ...args)
  }
}
