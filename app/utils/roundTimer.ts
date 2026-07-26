// app\utils\roundTimer.ts

/** Total countdown duration in seconds (base minutes + any added/removed bonus minutes). */
export function calculateTotalSeconds(durationMinutes: number, timeBonusMinutes: number): number {
  return durationMinutes * 60 + timeBonusMinutes * 60
}

/** Seconds remaining, clamped to [0, totalSeconds] — never negative, never over. */
export function calculateRemainingSeconds(totalSeconds: number, elapsedSeconds: number): number {
  return Math.max(0, totalSeconds - elapsedSeconds)
}

/** True once the countdown has reached zero. */
export function isTimerExpired(remainingSeconds: number): boolean {
  return remainingSeconds === 0
}

/** True once the timer has been started at least once and is currently paused (not fresh, not expired). */
export function isTimerPaused(isRunning: boolean, hasStarted: boolean, isExpired: boolean): boolean {
  return !isRunning && hasStarted && !isExpired
}

/**
 * Back-calculates the effective start timestamp from the current elapsed
 * value, so a resume correctly excludes time spent paused.
 */
export function calculateResumeStartTime(nowMs: number, elapsedSeconds: number): number {
  return nowMs - elapsedSeconds * 1000
}

/**
 * New bonus-minutes total after subtracting, floored so the round's total
 * duration (base + bonus) never goes below zero.
 */
export function clampSubtractedBonus(currentBonusMinutes: number, minutesToSubtract: number, durationMinutes: number): number {
  return Math.max(currentBonusMinutes - minutesToSubtract, -durationMinutes)
}
