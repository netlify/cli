const DEBOUNCE_INTERVAL = 300;
// `memoizedBuild` will avoid running the same build command multiple times
// until the previous operation has been completed. If another call is made
// within that period, it will be:
// - discarded if it happens before `DEBOUNCE_WAIT` has elapsed;
// - enqueued if it happens after `DEBOUNCE_WAIT` has elapsed.
// This allows us to discard any duplicate filesystem events, while ensuring
// that actual updates happening during the zip operation will be executed
// after it finishes (only the last update will run).
// @ts-expect-error TS(7031) FIXME: Binding element 'cache' implicitly has an 'any' ty... Remove this comment to see the full error message
export const memoizedBuild = ({ cache, cacheKey, command }) => {
    if (cache[cacheKey] === undefined) {
        cache[cacheKey] = {
            // eslint-disable-next-line promise/prefer-await-to-then
            task: command().finally(() => {
                const entry = cache[cacheKey];
                cache[cacheKey] = undefined;
                if (entry.enqueued !== undefined) {
                    memoizedBuild({ cacheKey, command, cache });
                }
            }),
            timestamp: Date.now(),
        };
    }
    else if (Date.now() > cache[cacheKey].timestamp + DEBOUNCE_INTERVAL) {
        cache[cacheKey].enqueued = true;
    }
    return cache[cacheKey].task;
};
