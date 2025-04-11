import { Command } from 'commander'

import { startAIHelp } from './command.js'

const program = new Command()

program.description('Chat with the Netlify CLI agent').action(startAIHelp)

program.parse(process.argv)
