import { readFile } from 'fs/promises'

import { beforeEach, describe, expect, test, vi } from 'vitest'

import getPackageJson from '../../../src/utils/get-package-json.mjs'

vi.mock('fs/promises', async (importActual) => {
  const fs = await importActual()

  return {
    ...fs,
    readFile: vi.fn(fs.readFile),
  }
})

describe('getPackageJson', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should return the package.json of netlify-cli', async () => {
    const packageJson = await getPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('netlify-cli')

    expect(readFile).toHaveBeenCalledOnce()
  })

  test('should not reread package.json', async () => {
    const packageJson = await getPackageJson()

    expect(packageJson).not.toBeUndefined()
    expect(packageJson.name).toBe('netlify-cli')

    expect(readFile).not.toHaveBeenCalled()
  })
})
