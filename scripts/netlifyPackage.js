// @ts-check
import assert from 'node:assert'
import { dirname, resolve } from 'node:path'
import { readFile, stat, writeFile } from 'node:fs/promises'

import execa from 'execa'

/**
 * @import {Package} from "normalize-package-data"
 */

const packageJSON = await getPackageJSON()

async function getPackageJSON() {
  const packageJSONPath = resolve('package.json')

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
  const binPath = Object.values(packageJSON.contents.bin ?? {})[0]
  if (!binPath) {
    throw new Error('Did not find a non-empty binary entry in `package.json`, so the `npx` flow will not work.')
  }

  const newPackageJSON = {
    ...packageJSON.contents,
    main: './dist/index.js',
    name: 'netlify',
    scripts: {
      ...packageJSON.contents.scripts,

      // We don't need the pre-publish script because we expect the work in
      // there to be done when publishing the `netlify-cli` package. We'll
      // ensure this is the case by throwing if a shrinkwrap file isn't found.
      prepublishOnly: undefined,
    },
    bin: {
      npxnetlify: binPath,
    },
  }

  try {
    const shrinkwrap = await stat(resolve(packageJSON.path, '../npm-shrinkwrap.json'))

    assert.ok(shrinkwrap.isFile())
  } catch {
    throw new Error('Failed to find npm-shrinkwrap.json file. Did you run the pre-publish script?')
  }

  console.log(`Writing updated package.json to ${packageJSON.path}...`)
  await writeFile(packageJSON.path, `${JSON.stringify(newPackageJSON, null, 2)}\n`)

  console.log('Regenerating shrinkwrap file with updated package name...')
  await execa('npm', ['shrinkwrap'], {
    cwd: dirname(packageJSON.path),
  })
}

await preparePackageJSON()
