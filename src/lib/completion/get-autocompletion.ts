import type { CompletionItem, ParseEnvResult } from '@pnpm/tabtab'

import type { AutocompletionData } from './constants.js'

const getAutocompletion = function (
  env: Pick<ParseEnvResult, 'complete' | 'lastPartial' | 'line' | 'words'>,
  program: AutocompletionData,
): CompletionItem[] | undefined {
  if (!env.complete) {
    return
  }
  // means that we are currently in the first command (the root command)
  if (env.words === 1) {
    const rootCommands = Object.values(program).map(({ description, name }) => ({ name, description }))

    // suggest all commands
    // $ netlify <cursor>
    if (env.lastPartial.length === 0) {
      return rootCommands
    }

    // $ netlify add<cursor>
    // we can now check if a command starts with the last partial
    const autocomplete = rootCommands.filter(({ name }) => name.startsWith(env.lastPartial))
    return autocomplete
  }

  const [, command, ...args] = env.line.split(' ')

  // Guards against inherited keys like `constructor` being treated as commands
  if (Object.hasOwn(program, command)) {
    const usedArgs = new Set(args)
    const unusedOptions = program[command].options.filter(({ name }) => !usedArgs.has(name))

    if (env.lastPartial.length !== 0) {
      return unusedOptions.filter(({ name }) => name.startsWith(env.lastPartial))
    }

    // suggest options that are not used
    return unusedOptions
  }
  return undefined
}

export default getAutocompletion
