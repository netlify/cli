/*
 * This script runs after an end user installs the CLI. It installs command-line completion, prints
 * a welcome message, etc.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
// eslint-disable-next-line no-restricted-imports
import chalk from 'chalk'
import boxen from 'boxen'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NETLIFY_CYAN_HEX = '#28b5ac'

const postInstall = async () => {
  const { createMainCommand } = await import('../dist/commands/index.js')
  const { generateAutocompletion } = await import('../dist/lib/completion/index.js')

  // yarn plug and play seems to have an issue with reading an esm file by building up the cache.
  // as yarn pnp analyzes everything inside the postinstall
  // yarn pnp executes it out of a .yarn folder .yarn/unplugged/netlify-cli-file-fb026a3a6d/node_modules/netlify-cli/scripts/postinstall.js
  if (!process.argv[1].includes('.yarn')) {
    // create or update the autocompletion definition
    const program = createMainCommand()
    generateAutocompletion(program)
  }

  console.log('')
  console.log(
    boxen(
      `Success! Netlify CLI has been installed!

      You can now use Netlify CLI to develop, deploy, and manage your Netlify projects.

      🚀 Now get building!`,
      {
        padding: 1,
        margin: 1,
        textAlignment: 'center',
        borderStyle: 'round',
        borderColor: NETLIFY_CYAN_HEX,
        // This is an intentional half-width space to work around a unicode padding math bug in boxen
        title: '⬥ ',
        titleAlignment: 'center',
      },
    ),
  )
  console.log('Next steps:')
  console.log(`  ${chalk.cyanBright.bold('netlify login')}    Log in to your Netlify account`)
  console.log(
    `  ${chalk.cyanBright.bold('netlify init')}     Connect or create a Netlify project from the current directory`,
  )
  console.log(`  ${chalk.cyanBright.bold('netlify deploy')}   Deploy the latest changes to your Netlify project`)
  console.log(`  ${chalk.cyanBright.bold('netlify help')}     Find out what else you can do 👀`)
  console.log('')
  console.log(`For more help with the CLI, visit ${chalk.cyanBright.bold('https://developers.netlify.com/cli')}`)
  console.log('')
  console.log(`For help with Netlify, visit ${chalk.cyanBright.bold('https://docs.netlify.com')}`)
  console.log('')
}

const main = async () => {
  // Check if this post-install script is being run by an end user installation
  // (`npm install [-g] netlify-cli`) or during local development (`npm install`/`npm ci`)
  let isEndUserInstall = false
  try {
    await fs.stat(path.resolve(__dirname, '../.git'))
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      isEndUserInstall = true
    }
  }

  if (isEndUserInstall) {
    await postInstall()
  }
}

await main()
