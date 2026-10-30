import { describe, expect, test, vi } from 'vitest'

import { EdgeFunctionsRegistryImpl } from '../../../../src/lib/edge-functions/registry.js'

/**
 * Tests for EdgeFunctionsRegistryImpl.build() coalescing behavior.
 *
 * The build(), buildPending, buildPromise, and doBuild members are public on
 * the implementation class (but not on the EdgeFunctionsRegistry interface),
 * allowing direct unit testing of the coalescing logic.
 */

describe('EdgeFunctionsRegistryImpl.build() coalescing', () => {
  const createMockRegistry = () => {
    const state = { buildCount: 0, shouldFail: false }

    // Create instance with prototype chain for build() method
    const registry = Object.create(EdgeFunctionsRegistryImpl.prototype) as EdgeFunctionsRegistryImpl

    // Initialize properties needed for build()
    registry.buildPending = false
    registry.buildPromise = null
    registry.doBuild = vi.fn(async () => {
      state.buildCount++
      await new Promise((resolve) => setTimeout(resolve, 10))
      if (state.shouldFail) {
        state.shouldFail = false
        throw new Error('Build failed')
      }
      return { warnings: {} }
    })

    return { registry, state }
  }

  test('concurrent calls coalesce into fewer builds', async () => {
    const { registry, state } = createMockRegistry()

    const results = await Promise.all([registry.build(), registry.build(), registry.build()])

    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r).toEqual({ warnings: {} })
    }
    // First build + one rebuild for pending = 2 total
    expect(state.buildCount).toBe(2)

    // Subsequent call after all concurrent calls complete triggers a NEW build
    await registry.build()
    expect(state.buildCount).toBe(3)
  })

  test('retries pending build on failure', async () => {
    const { registry, state } = createMockRegistry()
    state.shouldFail = true

    const [result1, result2] = await Promise.allSettled([registry.build(), registry.build()])

    expect(result1.status).toBe('fulfilled') // First call gets retry result
    expect(result2.status).toBe('rejected') // Concurrent call gets the original failure
    expect(state.buildCount).toBe(2)
  })
})

describe('EdgeFunctionsRegistryImpl.matchURLPath() percent-encoded paths', () => {
  const createRegistryWithRoute = () => {
    const registry = Object.create(EdgeFunctionsRegistryImpl.prototype) as EdgeFunctionsRegistryImpl
    // `routes` and `manifest` are private; matchURLPath() only reads them, so
    // setting them directly is enough to exercise it in isolation.
    const registryInternals = registry as unknown as { routes: unknown[]; manifest: unknown }

    // A route pattern as it would be compiled for `/admin/*`: written against
    // the decoded path, same as it's authored in a project's routing config.
    registryInternals.routes = [
      {
        function: 'admin-guard',
        pattern: /^\/admin\/.*$/,
        excluded_patterns: [],
      },
    ]
    registryInternals.manifest = null

    return registry
  }

  test('matches a route for the literal, unencoded path', () => {
    const registry = createRegistryWithRoute()

    const { functionNames } = registry.matchURLPath('/admin/secretpath', 'GET', {})

    expect(functionNames).toEqual(['admin-guard'])
  })

  test('matches a route when the request path is percent-encoded', () => {
    const registry = createRegistryWithRoute()

    // "%61" is a percent-encoded "a": this requests the same logical path as
    // /admin/secretpath, just spelled differently on the wire.
    const { functionNames } = registry.matchURLPath('/%61dmin/secretpath', 'GET', {})

    expect(functionNames).toEqual(['admin-guard'])
  })

  test('falls back to the raw path for malformed percent-encoding instead of throwing', () => {
    const registry = createRegistryWithRoute()

    expect(() => registry.matchURLPath('/admin/%', 'GET', {})).not.toThrow()
  })
})
