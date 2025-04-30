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

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  console.log(chalk.greenBright.bold.underline('Success! Netlify CLI has been installed!'))
  console.log('')
  console.log('Your device is now configured to use Netlify CLI to deploy and manage your Netlify sites.')
  console.log('')
  console.log('Next steps:')
  console.log('')
  console.log(
    `  ${chalk.cyanBright.bold('netlify init')}     Connect or create a Netlify site from current directory`,
  )
  console.log(
    `  ${chalk.cyanBright.bold('netlify deploy')}   Deploy the latest changes to your Netlify site`,
  )
  console.log('')
  console.log(`For more information on the CLI run ${chalk.cyanBright.bold('netlify help')}`)
  console.log(`Or visit the docs at ${chalk.cyanBright.bold('https://cli.netlify.com')}`)
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
