import * as module from 'module';
import { isCI } from 'ci-info';
export let didEnableCompileCache = false;
/**
 * This enables the Node.js compile cache (aka the V8 code cache or bytecode cache), if it is available and if we
 * detect that we are not running in a CI environment.
 *
 * This feature is a performance optimization that allows the V8 JS engine to cache some (parse/compile) work from one
 * execution on disk and reuse it on subsequent executions. There's a performance hit on the first (cold) run, but all
 * subsequent (warm) runs get performance savings. As the CLI is generally run hundreds of times, it is worth a small
 * overhead on the occasional cold run to shave tens to hundreds of milliseconds on several subsequent warm runs.
 *
 * Keep in mind that the cache is specific to a version of netlify-cli and a version of node.js and it is stored on the
 * user's disk in a temp dir. If any of these changes or the temp dir is cleared, the next run is a cold run.
 *
 * The programmatic API to enable this (`enableCompileCache()`) was added in node 22.8.0, but we currently support
 * >=20.12.2, hence the conditional below. (For completeness, note that support via the env var was added in 22.1.0.)
 *
 * The Netlify CLI is often used in CI workflows. In this context, we wouldn't want the overhead of the first run
 * because we almost certainly would not get any benefits on "subsequent runs". Even if the user has configured caching
 * of the CLI itself, there's no chance they've configured the V8 compile cache directory to be cached.
 *
 * @see https://nodejs.org/api/module.html#moduleenablecompilecachecachedir
 */
export const maybeEnableCompileCache = () => {
    if (isCI)
        return;
    // The docs recommend turning this off when running tests to generate precise coverage
    if (process.env.NODE_ENV === 'test')
        return;
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    if ('enableCompileCache' in module && typeof module.enableCompileCache === 'function') {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        const { directory } = module.enableCompileCache();
        if (directory == null)
            return;
        didEnableCompileCache = true;
        // TODO(serhalp): Investigate enabling the compile cache for spawned subprocesses by passing
        // NODE_COMPILE_CACHE=directory.
        return;
    }
    return;
};
//# sourceMappingURL=nodejs-compile-cache.js.map