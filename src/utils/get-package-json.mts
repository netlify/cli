import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// @ts-expect-error TS(7034) FIXME: Variable 'packageJson' implicitly has type 'any' i... Remove this comment to see the full error message
let packageJson

const getPackageJson = async () => {
  // @ts-expect-error TS(7005) FIXME: Variable 'packageJson' implicitly has an 'any' typ... Remove this comment to see the full error message
  if (!packageJson) {
    // @ts-expect-error TS(1470) FIXME: The 'import.meta' meta-property is not allowed in ... Remove this comment to see the full error message
    const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../../package.json')
    // @ts-expect-error TS(2345) FIXME: Argument of type 'Buffer' is not assignable to par... Remove this comment to see the full error message
    packageJson = JSON.parse(await readFile(packageJsonPath))
  }

  // @ts-expect-error TS(7005) FIXME: Variable 'packageJson' implicitly has an 'any' typ... Remove this comment to see the full error message
  return packageJson
}

export default getPackageJson
