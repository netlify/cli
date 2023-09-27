import { preview as SdkPreview } from '@netlify/sdk/commands'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { preview } from '../../../../src/commands/integration/preview.mjs'

vi.mock('@netlify/sdk/commands', () => ({
    preview: vi.fn() }))

describe('integration:preview', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })
  test('runs dev method from sdk', async () => {

    await preview({})

    expect(SdkPreview).toHaveBeenCalled()

  })

})

