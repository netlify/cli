import { readFile } from 'fs/promises'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import getCLIPackageJson from '../../../src/utils/get-cli-package-json.js'

vi.mock('fs/promises', async (importActual: () => Promise<typeof import('fs/promises')>) => {
  const fs = await importActual()

  return {
    ...fs,
    readFile: vi.fn(fs.readFile),
  }
})

describe('getCLIPackageJson', () => {
  beforeEach(() => {
    // Reevaluate modules when imported in order to avoid issues with singleton pattern in getPackageJson
    vi.resetModules()
  })

  test('should return the package.json of netlify-cli', async () => {
    const packageJson = await getCLIPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('netlify-cli')
  })

  test('should not re-read package.json', async () => {
    // first call reads from file-system
    await getCLIPackageJson()
    expect(readFile).toHaveBeenCalledOnce()

    vi.mocked(readFile).mockClear()

    // second call should cache and not read from file-system
    const packageJson = await getCLIPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('netlify-cli')

    expect(readFile).not.toHaveBeenCalled()
  })
})
