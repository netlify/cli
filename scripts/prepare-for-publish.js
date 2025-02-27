import { readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import execa from 'execa'
import ora from 'ora'

const insertUserPostinstall = (pkgJson) => {
  pkgJson.scripts.postinstall = pkgJson.scripts['postinstall-pack']
  delete pkgJson.scripts['postinstall-pack']
}

const installDeps = async () => {
  let spinner = ora('Running `npm install --no-audit`').start()
  await execa('npm', ['install', '--no-audit'])
  spinner.succeed()

  spinner = ora('Running `npm shrinkwrap`').start()
  await execa('npm', ['shrinkwrap'])
  spinner.succeed()
}

// NOTE: this must run before `cleanPackageJson`, otherwise the `build` script has been deleted
const buildPackageForPublish = async () => {
  const spinner = ora('Running `npm run build`').start()
  await execa('npm', ['run', 'build'])
  spinner.succeed()
}

const SCRIPTS_TO_KEEP_ON_PUBLISHED_PKG = new Set([
  'postinstall-pack',
  'postpack',
  'preinstall',
  'prepack',
  'prepublish',
  'prepublishOnly',
])

const cleanPackageJson = (pkgJson) => {
  delete pkgJson.devDependencies
  delete pkgJson.ava
  delete pkgJson.config

  for (const scriptName in pkgJson.scripts) {
    if (SCRIPTS_TO_KEEP_ON_PUBLISHED_PKG.has(scriptName)) continue

    delete pkgJson.scripts[scriptName]
  }
}

const writeUpdatedPackageJson = async (pkgJson, packageJsonPath) => {
  const spinner = ora('Patching package.json (removing devDependencies, scripts, etc').start()
  await writeFile(packageJsonPath, JSON.stringify(pkgJson, null, 2))
  spinner.succeed()
}

const main = async () => {
  const dir = dirname(fileURLToPath(import.meta.url))
  const pkgJsonPath = join(dir, '../package.json')
  const pkgJson = JSON.parse(await readFile(pkgJsonPath))

  await installDeps()

  await buildPackageForPublish()

  insertUserPostinstall(pkgJson)
  cleanPackageJson(pkgJson)
  await writeUpdatedPackageJson(pkgJson, pkgJsonPath)
}

await main()
