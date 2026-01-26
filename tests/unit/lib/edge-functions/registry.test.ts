import { describe, expect, test, vi } from 'vitest'

import { EdgeFunctionsRegistry } from '../../../../src/lib/edge-functions/registry.js'

/**
 * Tests for EdgeFunctionsRegistry.build() coalescing behavior.
 *
 * The build(), buildPending, buildPromise, and doBuild members are protected
 * to allow testing. We create a minimal instance using Object.create to test
 * the coalescing logic in isolation without the full constructor dependencies.
 */

/** Test harness exposing protected members for build coalescing tests */
interface TestableRegistry {
  buildPending: boolean
  buildPromise: Promise<{ warnings: Record<string, string[]> }> | null
  doBuild: () => Promise<{ warnings: Record<string, string[]> }>
  build: () => Promise<{ warnings: Record<string, string[]> }>
}

describe('EdgeFunctionsRegistry.build() coalescing', () => {
  const createMockRegistry = () => {
    const state = { buildCount: 0, shouldFail: false }

    // Create instance with prototype chain for build() method, typed to expose protected members
    const registry = Object.create(EdgeFunctionsRegistry.prototype) as TestableRegistry

    // Initialize protected properties needed for build()
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
