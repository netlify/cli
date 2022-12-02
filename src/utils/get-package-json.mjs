import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

let packageJson

const getPackageJson = async () => {
  if (!packageJson) {
    const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json')
    packageJson = JSON.parse(await readFile(packageJsonPath))
  }

  return packageJson
}

export default getPackageJson
