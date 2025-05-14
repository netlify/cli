// @ts-check
import assert from 'node:assert'
import { basename, dirname, resolve } from 'node:path'
import { argv } from 'node:process'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

import execa from 'execa'

const packageJSON = await getPackageJSON()

async function getPackageJSON() {
  const packageJSONPath = resolve(fileURLToPath(import.meta.url), '../../package.json')
  const contents = JSON.parse(await readFile(packageJSONPath, 'utf8'))

  return {
    contents,
    path: packageJSONPath,
  }
}

/**
 * @type {Record<string, function>}
 */
const commands = {
  prepare: async () => {
    const newPackageJSON = {
      ...packageJSON.contents,
      main: './dist/index.js',
      name: 'netlify',
    }

    console.log(`Writing updated package.json to ${packageJSON.path}...`)
    await writeFile(packageJSON.path, `${JSON.stringify(newPackageJSON, null, 2)}\n`)

    console.log('Re-installing dependencies to update lockfile...')
    await execa('npm', ['install'], {
      cwd: dirname(packageJSON.path),
    })
  },

  verify: async () => {
    const { stdout } = await execa('npx', ['-y', 'netlify', '--version'])
    const version = stdout.match(/netlify-cli\/(\d+\.\d+\.\d+)/)

    assert.equal(version, packageJSON.contents.version, 'Version installed via npx matches latest version')
  },
}

if (typeof commands[argv[2]] === 'function') {
  await commands[argv[2]]()
} else {
  console.error(`Usage: node ${basename(argv[1])} <command> (available commands: ${Object.keys(commands).join(', ')})`)
}
