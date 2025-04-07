import { beforeAll, describe, expect, test, vi } from 'vitest'
import { readPackageUp } from 'read-package-up'

import getCLIPackageJson from '../../../src/utils/get-cli-package-json.js'

vi.mock('read-package-up')

describe('getPackageJson', () => {
  beforeAll(() => {
    vi.mocked(readPackageUp).mockResolvedValue({
      path: '/foo',
      packageJson: { name: 'mocked-netlify-cli' },
    })
  })

  test('should return the package.json of netlify-cli', async () => {
    const packageJson = await getCLIPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('mocked-netlify-cli')
  })

  test('should not re-read package.json', async () => {
    // first call reads from file-system
    await getCLIPackageJson()
    expect(readPackageUp).toHaveBeenCalledOnce()

    vi.mocked(readPackageUp).mockClear()

    // second call should cache and not read from file-system
    const packageJson = await getCLIPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('mocked-netlify-cli')

    expect(readPackageUp).not.toHaveBeenCalled()
  })
})
