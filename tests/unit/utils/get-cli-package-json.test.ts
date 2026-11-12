import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('fs/promises', async (importActual: () => Promise<typeof import('fs/promises')>) => {
  const fs = await importActual()

  return {
    ...fs,
    readFile: vi.fn(fs.readFile),
  }
})

describe('getCLIPackageJson', () => {
  let getCLIPackageJson: typeof import('../../../src/utils/get-cli-package-json.js').default
  let readFile: typeof import('fs/promises').readFile

  beforeEach(async () => {
    // Reevaluate modules (and the mock factory) to avoid the singleton cache in getPackageJson leaking between tests
    vi.resetModules()
    ;({ readFile } = await import('fs/promises'))
    ;({ default: getCLIPackageJson } = await import('../../../src/utils/get-cli-package-json.js'))
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
