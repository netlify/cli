import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import execa from 'execa'
import ora from 'ora'

let spinner = ora({
  spinner: 'star',
  text: 'Patching package.json (removing devDependencies, scripts, etc)',
}).start()

const dir = dirname(fileURLToPath(import.meta.url))
const packageJsonPath = join(dir, '../package.json')

const pkgJson = JSON.parse(await readFile(packageJsonPath))

delete pkgJson.devDependencies
delete pkgJson.ava
delete pkgJson.config

// eslint-disable-next-line fp/no-loops
for (const scriptName in pkgJson.scripts) {
  if (scriptName === 'postinstall' || scriptName === 'prepublishOnly') continue

  delete pkgJson.scripts[scriptName]
}
await writeFile(packageJsonPath, JSON.stringify(pkgJson, null, 2))
spinner.succeed()

spinner = ora({
  spinner: 'star',
  text: 'Running `npm install --no-audit`',
}).start()
await execa('npm', ['install', '--no-audit'])
spinner.succeed()

spinner = ora({
  spinner: 'star',
  text: 'Running `npm shrinkwrap`',
}).start()
await execa('npm', ['shrinkwrap'])
spinner.succeed()
