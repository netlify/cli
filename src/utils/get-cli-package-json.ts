import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { type NormalizedPackageJson, readPackage } from 'read-pkg'

let packageJson: NormalizedPackageJson | undefined

const getCLIPackageJson = async (): Promise<NormalizedPackageJson> => {
  if (!packageJson) {
    const cliProjectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    let result
    try {
      result = await readPackage({ cwd: cliProjectRoot, normalize: true })
    } catch (error) {
      throw new Error('Could not find package.json', { cause: error })
    }
    packageJson = result
  }

  return packageJson
}

export default getCLIPackageJson
