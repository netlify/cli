import process from 'process'

import pc from 'picocolors'

import { createMainCommand } from '../dist/commands/index.js'
import { generateAutocompletion } from '../dist/lib/completion/index.js'

const postInstall = () => {
  // yarn plug and play seems to have an issue with reading an esm file by building up the cache.
  // as yarn pnp analyzes everything inside the postinstall
  // yarn pnp executes it out of a .yarn folder .yarn/unplugged/netlify-cli-file-fb026a3a6d/node_modules/netlify-cli/scripts/postinstall.js
  if (!process.argv[1].includes('.yarn')) {
    // create or update the autocompletion definition
    const program = createMainCommand()
    generateAutocompletion(program)
  }

  console.log('')
  console.log(pc.greenBright(pc.bold(pc.underline('Success! Netlify CLI has been installed!'))))
  console.log('')
  console.log('Your device is now configured to use Netlify CLI to deploy and manage your Netlify sites.')
  console.log('')
  console.log('Next steps:')
  console.log('')
  console.log(`  ${pc.cyanBright(pc.bold('netlify init'))}     Connect or create a Netlify site from current directory`)
  console.log(`  ${pc.cyanBright(pc.bold('netlify deploy'))}   Deploy the latest changes to your Netlify site`)
  console.log('')
  console.log(`For more information on the CLI run ${pc.cyanBright(pc.bold('netlify help'))}`)
  console.log(`Or visit the docs at ${pc.cyanBright(pc.bold('https://cli.netlify.com'))}`)
  console.log('')
}

postInstall()
