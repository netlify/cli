/**
 * Checks whether a value is effectively empty.
 *
 * A value is considered empty when it is `null`, `undefined`, or an object
 * with no own enumerable keys. Intended as a minimal stand-in for the handful
 * of `lodash/isEmpty` call sites that only ever receive plain objects or
 * nullish values (e.g. API response payloads that may be absent).
 *
 * @param obj - The object to check, or a nullish value.
 * @returns `true` if the value is nullish or has no own enumerable keys.
 */
export const isEmpty = (obj: object | null | undefined): boolean => obj == null || Object.keys(obj).length === 0

/**
 * Returns a new object containing only the specified keys from the source.
 *
 * Mirrors the shape of `lodash/pick` but is intentionally loosely typed so it
 * can accept string keys that are not declared on the source type. This is
 * pragmatic for CLI output filtering of API responses whose generated types
 * sometimes omit fields the server actually returns.
 *
 * Keys that are not present on the source are silently skipped.
 *
 * @param obj - The source object to pick properties from.
 * @param keys - The property names to include in the result.
 * @returns A new object with only the requested keys that exist on the source.
 */
export const pick = <T extends object>(obj: T, keys: readonly string[]): Partial<T> =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, (obj as Record<string, unknown>)[k]])) as Partial<T>

/**
 * Recursively merges the properties of `source` into a copy of `target`.
 *
 * Only plain (non-array) objects are merged recursively; arrays and primitive
 * values from `source` overwrite the corresponding value in `target`. Neither
 * argument is mutated. Behavior is intentionally narrow: this is not a full
 * replacement for `lodash/merge`, only enough to cover the existing call sites
 * that merge shallow-nested config objects.
 *
 * @param target - The base object to merge into. `undefined` is treated as `{}`.
 * @param source - The object whose properties take precedence over `target`.
 * @returns A new object containing the combined properties.
 */
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

/**
 * Wraps a function so that it runs at most once per `intervalMs` milliseconds.
 *
 * Uses leading-edge invocation: the first call runs immediately, and any calls
 * that arrive within `intervalMs` of the previous invocation are dropped.
 * There is no trailing call -- this is intentional for fire-and-forget
 * side-effect callers (e.g. rate-limited activity pings) where losing the
 * final invocation is acceptable.
 *
 * @param fn - The function to throttle.
 * @param intervalMs - Minimum time between invocations, in milliseconds.
 * @returns A throttled wrapper around `fn` with the same arguments signature.
 */
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
