import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import execa from 'execa'
import ora from 'ora'

// These scripts from package.json need to be preserved on publish
const preserveScripts = new Set([
  'postinstall-pack',
  'postpack',
  'preinstall',
  'prepack',
  'prepublish',
  'prepublishOnly',
])

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

for (const scriptName in pkgJson.scripts) {
  if (preserveScripts.has(scriptName)) continue

  delete pkgJson.scripts[scriptName]
}

pkgJson.scripts.postinstall = pkgJson.scripts['postinstall-pack']
delete pkgJson.scripts['postinstall-pack']

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
