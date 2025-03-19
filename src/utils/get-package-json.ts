import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { type NormalizedPackageJson, readPackageUp } from 'read-package-up'

let packageJson: NormalizedPackageJson | undefined

// TODO(serhalp) Consider renaming. We read all sorts of different `package.json` files in this repo for all sorts of
// different reasons, and this one is only for reading our OWN package.json.
const getPackageJson = async (): Promise<NormalizedPackageJson> => {
  if (!packageJson) {
    const cliProjectRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const result = await readPackageUp({ cwd: cliProjectRoot, normalize: true })
    if (result?.packageJson == null) {
      throw new Error('Could not find package.json')
    }
    packageJson = result.packageJson
  }

  return packageJson
}

export default getPackageJson
