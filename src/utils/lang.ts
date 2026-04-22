export const isEmpty = (obj: object | null | undefined): boolean => obj == null || Object.keys(obj).length === 0

export const pick = <T extends object>(obj: T, keys: readonly string[]): Partial<T> =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, (obj as Record<string, unknown>)[k]])) as Partial<T>

export function deepMerge<T extends Record<string, unknown>>(target: T | undefined, source: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...(target ?? {}) }
  for (const key of Object.keys(source)) {
    const targetVal = result[key]
    const sourceVal = source[key]
    if (
      targetVal != null &&
      sourceVal != null &&
      typeof targetVal === 'object' &&
      typeof sourceVal === 'object' &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>)
    } else {
      result[key] = sourceVal
    }
  }
  return result as T
}

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  intervalMs: number,
): (...args: Args) => void {
  let lastCall = 0
  return (...args: Args) => {
    const now = Date.now()
    if (now - lastCall >= intervalMs) {
      lastCall = now
      fn(...args)
    }
  }
}
