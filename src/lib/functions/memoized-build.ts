const DEBOUNCE_INTERVAL = 300

export type BuildCommandCache<T extends undefined | Record<string, unknown>> = Record<
  string,
  undefined | { enqueued?: true; task: Promise<T>; timestamp: number }
>

// `memoizedBuild` will avoid running the same build command multiple times
// until the previous operation has been completed. If another call is made
// within that period, it will be:
// - discarded if it happens before `DEBOUNCE_WAIT` has elapsed;
// - enqueued if it happens after `DEBOUNCE_WAIT` has elapsed.
// This allows us to discard any duplicate filesystem events, while ensuring
// that actual updates happening during the zip operation will be executed
// after it finishes (only the last update will run).
export const memoizedBuild = <T extends undefined | Record<string, unknown>>({
  cache,
  cacheKey,
  command,
}: {
  cache: BuildCommandCache<T>
  cacheKey: string
  command: () => Promise<T>
}): Promise<T> => {
  if (cache[cacheKey] === undefined) {
    cache[cacheKey] = {
      task: command().finally(() => {
        const entry = cache[cacheKey]

        cache[cacheKey] = undefined

        if (entry?.enqueued !== undefined) {
          void memoizedBuild({ cacheKey, command, cache })
        }
      }),
      timestamp: Date.now(),
    }
  } else if (Date.now() > cache[cacheKey].timestamp + DEBOUNCE_INTERVAL) {
    cache[cacheKey].enqueued = true
  }

  return cache[cacheKey].task
}
