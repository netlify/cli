import { dev as SdkDev } from '@netlify/sdk/commands'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { dev } from '../../../../src/commands/integration/dev.mjs'

vi.mock('@netlify/sdk/commands', () => ({
    dev: vi.fn() }))

describe('integration:dev', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })
  test('runs dev method from sdk', async () => {

    await dev({})

    expect(SdkDev).toHaveBeenCalled()

  })

})

