/**
 * Composable for logging button clicks with contextual data
 */
export function useButtonLogging(buttonName: string, context?: Record<string, unknown>) {
  function logClick() {
    const evaluatedContext: Record<string, unknown> = {}
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        // If the value is a function, evaluate it
        evaluatedContext[key] = typeof value === 'function' ? value() : value
      }
    }
    const logData = {
      button: buttonName,
      timestamp: new Date().toISOString(),
      ...evaluatedContext,
    }
    console.log('[BUTTON CLICK]', logData)
  }

  return { logClick }
}
