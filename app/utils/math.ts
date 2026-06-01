// app\utils\math.ts

/**
 * Rounds a number to a given number of decimal places.
 * @param value - The number to round
 * @param decimals - Number of decimal places (default: 1)
 */
export function roundToDecimals(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Returns true if two numbers are within `epsilon` of each other.
 * Useful for floating-point comparisons.
 * @param a - First number
 * @param b - Second number
 * @param epsilon - Tolerance (default: 0.001)
 */
export function isCloseTo(a: number, b: number, epsilon = 0.001): boolean {
  return Math.abs(a - b) < epsilon
}
