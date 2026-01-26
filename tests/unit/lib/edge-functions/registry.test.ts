import { describe, expect, test, vi } from 'vitest'

import { EdgeFunctionsRegistry } from '../../../../src/lib/edge-functions/registry.js'

/**
 * Tests for EdgeFunctionsRegistry.build() coalescing behavior.
 *
 * We use a TestableRegistry interface + cast through `unknown` to access
 * private members needed for testing the build coalescing logic. The return
 * type of createMockRegistry is explicit to contain the broader type within
 * the test setup.
 */

/** Type exposing the private members we need for testing build coalescing */
interface TestableRegistry {
  buildPending: boolean
  buildPromise: Promise<{ warnings: Record<string, string[]> }> | null
  doBuild: () => Promise<{ warnings: Record<string, string[]> }>
  build: () => Promise<{ warnings: Record<string, string[]> }>
}

describe('EdgeFunctionsRegistry.build() coalescing', () => {
  const createMockRegistry = (): { registry: TestableRegistry; state: { buildCount: number; shouldFail: boolean } } => {
    const state = { buildCount: 0, shouldFail: false }

    // Create instance with minimal mocked dependencies
    const registry = Object.create(EdgeFunctionsRegistry.prototype) as unknown as TestableRegistry

    // Initialize only the properties needed for build()
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
