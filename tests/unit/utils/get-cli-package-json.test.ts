import { beforeAll, describe, expect, test, vi } from 'vitest'
import { readPackage } from 'read-pkg'

import getCLIPackageJson from '../../../src/utils/get-cli-package-json.js'

vi.mock('read-pkg')

describe('getPackageJson', () => {
  beforeAll(() => {
    vi.mocked(readPackage).mockResolvedValue({
      name: 'mocked-netlify-cli',
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
    expect(readPackage).toHaveBeenCalledOnce()

    vi.mocked(readPackage).mockClear()

    // second call should cache and not read from file-system
    const packageJson = await getCLIPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('mocked-netlify-cli')

    expect(readPackage).not.toHaveBeenCalled()
  })
})
