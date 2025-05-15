// @ts-check
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { readFile, stat,writeFile } from 'node:fs/promises'

import execa from 'execa'

/**
 * @import {Package} from "normalize-package-data"
 */

/**
 * Logs an error message and exits with status 1.
 *
 * @param {string} message 
 */
function errorAndExit(message) {
  console.error(message)

  process.exit(1)
}

const packageJSON = await getPackageJSON()

async function getPackageJSON() {
  const packageJSONPath = resolve(fileURLToPath(import.meta.url), '../../package.json')

  /**
   * @type {Package}
   */
  const contents = JSON.parse(await readFile(packageJSONPath, 'utf8'))

  return {
    contents,
    path: packageJSONPath,
  }
}

async function preparePackageJSON() {
  const newPackageJSON = {
    ...packageJSON.contents,
    main: './dist/index.js',
    name: 'netlify',
  }

  const shrinkwrap = await stat(resolve(packageJSON.path, "../npm-shrinkwrap.json"))
  if (!shrinkwrap.isFile()) {
    errorAndExit('Failed to find npm-shrinkwrap.json file. Did you run the pre-publish script?')
  }

  console.log(`Writing updated package.json to ${packageJSON.path}...`)
  await writeFile(packageJSON.path, `${JSON.stringify(newPackageJSON, null, 2)}\n`)

  console.log('Regenerating shrinkwrap file with updated package name...')
  await execa('npm', ['shrinkwrap'], {
    cwd: dirname(packageJSON.path),
  })
}

await preparePackageJSON()
