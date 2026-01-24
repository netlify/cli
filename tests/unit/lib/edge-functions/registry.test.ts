import { describe, expect, test, vi } from 'vitest'

import { EdgeFunctionsRegistry } from '../../../../src/lib/edge-functions/registry.js'

/**
 * Tests for EdgeFunctionsRegistry.build() coalescing behavior.
 */
describe('EdgeFunctionsRegistry.build() coalescing', () => {
  const createMockRegistry = () => {
    const state = { buildCount: 0, shouldFail: false }

    // Create instance with minimal mocked dependencies
    const registry = Object.create(EdgeFunctionsRegistry.prototype) as InstanceType<typeof EdgeFunctionsRegistry>

    // Initialize only the properties needed for build()
    // @ts-expect-error -- accessing private members for testing
    registry.buildPending = false
    // @ts-expect-error -- accessing private members for testing
    registry.buildPromise = null
    // @ts-expect-error -- accessing private members for testing
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

    // @ts-expect-error -- accessing private method for testing
    const results = await Promise.all([registry.build(), registry.build(), registry.build()])

    expect(results).toHaveLength(3)
    for (const r of results) {
      expect(r).toEqual({ warnings: {} })
    }
    expect(state.buildCount).toBe(2) // First build + one more rebuild for pending
  })

  test('retries pending build on failure', async () => {
    const { registry, state } = createMockRegistry()
    state.shouldFail = true

    // @ts-expect-error -- accessing private method for testing
    const [result1, result2] = await Promise.allSettled([registry.build(), registry.build()])

    expect(result1.status).toBe('fulfilled') // First call gets retry result
    expect(result2.status).toBe('rejected') // Concurrent call gets the original failure
    expect(state.buildCount).toBe(2)
  })
})
