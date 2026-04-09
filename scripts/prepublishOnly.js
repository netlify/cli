import * as cp from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const main = async () => {
  // It's best practice to include a shrinkwrap when shipping a CLI. npm has a bug that makes it
  // not ignore development dependencies in an installed package's shrinkwrap, though:
  //
  // https://github.com/npm/cli/issues/4323
  //
  // Leaving development dependencies makes the CLI installation significantly larger and increases
  // the risk of platform-specific dependency installation issues.
  // eslint-disable-next-line no-restricted-properties
  const packageJSONPath = path.join(process.cwd(), 'package.json')
  const rawPackageJSON = await fs.readFile(packageJSONPath, 'utf8')

  // Remove dev dependencies from the package.json...
  const packageJSON = JSON.parse(rawPackageJSON)
  Reflect.deleteProperty(packageJSON, 'devDependencies')
  await fs.writeFile(packageJSONPath, JSON.stringify(packageJSON, null, 2))

  // Prune out dev dependencies (this updates the `package-lock.json` lockfile)
  cp.spawnSync('npm', ['prune'], { stdio: 'inherit' })

  // Convert `package-lock.json` lockfile to `npm-shrinkwrap.json`
  cp.spawnSync('npm', ['shrinkwrap'], { stdio: 'inherit' })
}

await main()
