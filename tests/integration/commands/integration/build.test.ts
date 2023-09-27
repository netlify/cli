import { build as SdkBuild } from '@netlify/sdk/commands'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { build } from '../../../../src/commands/integration/build.mjs'

vi.mock('@netlify/sdk/commands', () => ({
    build: vi.fn() }))

describe('integration:build', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })
  test('runs dev method from sdk', async () => {

    await build({})

    expect(SdkBuild).toHaveBeenCalled()

  })

})

