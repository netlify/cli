import { locatePath } from 'locate-path'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import getStatic from '../../../../src/utils/proxy/get-static.mjs'

vi.mock('locate-path', () => ({
  locatePath: vi.fn(),
}))

describe('getStatic', () => {
  beforeEach(() => {
    vi.mocked(locatePath).mockClear()
  })

  test('finds html file', async () => {
    vi.mocked(locatePath).mockReturnValueOnce('/folder.html')

    expect(await getStatic('/folder/', '/')).toEqual('/folder.html')
    expect(locatePath).toHaveBeenCalledOnce()
  })

  test('nothing found', async () => {
    vi.mocked(locatePath).mockReturnValueOnce()

    expect(await getStatic('/folder/', '/')).toEqual(undefined)
    expect(locatePath).toHaveBeenCalledOnce()
  })
})
