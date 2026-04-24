/**
 * Composable per logging dei click sui bottoni con dati contestuali
 */
export function useButtonLogging(buttonName: string, context?: Record<string, unknown>) {
  function logClick() {
    const evaluatedContext: Record<string, unknown> = {}
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        // Se il valore è una funzione, valutala
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
