import { OptionValues } from 'commander'
import terminalLink from 'terminal-link'

import BaseCommand from '../base-command.js'

export const createLoginCommand = (program: BaseCommand) =>
  program
    .command('login')
    .description(
      `Login to your Netlify account
Opens a web browser to acquire an OAuth token, which is stored in your operating system's keychain
(macOS Keychain, Windows Credential Manager or Linux Secret Service) when available.
To store it in a plaintext config file instead, set NETLIFY_USE_LEGACY_AUTH_STORAGE=1. This is not recommended.`,
    )
    .option('--new', 'Login to new Netlify account')
    .option('--request <message>', 'Create a login ticket for agent/human-in-the-loop auth')
    .option('--check <ticket-id>', 'Check the status of a login ticket created with --request')
    .option('--json', 'Output as JSON (for use with --request or --check)')
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/cli/get-started/#authentication'
      return `
For more information about Netlify authentication, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { login } = await import('./login.js')
      await login(options, command)
    })
