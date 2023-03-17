import { locatePath } from 'locate-path'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import findStaticFileForURLPath from '../../../../src/utils/proxy/find-static-file-for-url-path.mjs'

vi.mock('locate-path', () => ({
  locatePath: vi.fn(),
}))

describe('findStaticFileForURLPath', () => {
  beforeEach(() => {
    vi.mocked(locatePath).mockClear()
  })

  test('finds html file', async () => {
    vi.mocked(locatePath).mockReturnValueOnce('/folder.html')

    expect(await findStaticFileForURLPath('/folder/', '/')).toEqual('/folder.html')
    expect(locatePath).toHaveBeenCalledOnce()
  })

  test('nothing found', async () => {
    vi.mocked(locatePath).mockReturnValueOnce()

    expect(await findStaticFileForURLPath('/folder/', '/')).toEqual(undefined)
    expect(locatePath).toHaveBeenCalledOnce()
  })
})
