// @ts-check
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

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
    bin: {
      npxnetlify: binPath,
    },
  }

  console.log(`Writing updated package.json to ${packageJSON.path}...`)
  await writeFile(packageJSON.path, `${JSON.stringify(newPackageJSON, null, 2)}\n`)
}

await preparePackageJSON()
