import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import normalizePackageData, { type Package } from 'normalize-package-data'

let packageJson: Package | undefined

const getPackageJson = async (): Promise<Package> => {
  if (!packageJson) {
    const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json')
    const packageData = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as Record<string, unknown>
    try {
      normalizePackageData(packageData)
      packageJson = packageData as Package
      return packageJson
    } catch (error) {
      throw new Error('Could not find package.json', { cause: error })
    }
  }
  return packageJson
}

export default getPackageJson
