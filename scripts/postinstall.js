import process from 'process'

import chalk from 'chalk'

import { createMainCommand } from '../src/commands/index.js'
import { generateAutocompletion } from '../src/lib/completion/index.js'
import { NetlifyLog, intro, outro } from '../src/utils/styles/index.js'

const id = (message) => message

/**
 *
 * @param {string} message
 * @param {Array<chalk['Color'] | chalk['Modifiers']>} styles
 * @returns
 */
const format = (message, styles) => {
  let func = id
  try {
    func = chalk
    styles.forEach((style) => {
      func = func[style]
    })
  } catch {}
  return func(message)
}

const postInstall = async () => {
  intro('Running postinstall script')
  // yarn plug and play seems to have an issue with reading an esm file by building up the cache.
  // as yarn pnp analyzes everything inside the postinstall
  // yarn pnp executes it out of a .yarn folder .yarn/unplugged/netlify-cli-file-fb026a3a6d/node_modules/netlify-cli/scripts/postinstall.js
  if (!process.argv[1].includes('.yarn')) {
    // create or update the autocompletion definition
    const program = createMainCommand()
    generateAutocompletion(program)
  }

  NetlifyLog.success(await format('Success! Netlify CLI has been installed!', ['greenBright', 'bold', 'underline']))
  NetlifyLog.info('Your device is now configured to use Netlify CLI to deploy and manage your Netlify sites.')
  NetlifyLog.info('Next steps:')
  NetlifyLog.info(
    `  ${await format('netlify init', [
      'cyanBright',
      'bold',
    ])}     Connect or create a Netlify site from current directory`,
  )
  NetlifyLog.info(
    `  ${await format('netlify deploy', ['cyanBright', 'bold'])}   Deploy the latest changes to your Netlify site`,
  )
  NetlifyLog.info(`For more information on the CLI run ${await format('netlify help', ['cyanBright', 'bold'])}`)
  NetlifyLog.info(`Or visit the docs at ${await format('https://cli.netlify.com', ['cyanBright', 'bold'])}`)

  outro({ message: 'Postinstall script finished' })
}

await postInstall()
