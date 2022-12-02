import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { install, uninstall } from 'tabtab'

import { generateAutocompletion } from '../../lib/completion/index.mjs'

const completer = join(dirname(fileURLToPath(import.meta.url)), '../../lib/completion/script.mjs')

/**
 * The completion:generate command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const completionGenerate = async (options, command) => {
  const { parent } = command

  generateAutocompletion(parent)

  await install({
    name: parent.name(),
    completer,
  })

  console.log(`Completion for ${parent.name()} successful installed!`)
}

/**
 * Creates the `netlify completion` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createCompletionCommand = (program) => {
  program
    .command('completion:install')
    .alias('completion:generate')
    .description('Generates completion script for your preferred shell')
    .action(completionGenerate)

  program
    .command('completion:uninstall', { hidden: true })
    .alias('completion:remove')
    .description('Uninstalls the installed completions')
    .addExamples(['netlify completion:uninstall'])
    .action(async (options, command) => {
      await uninstall({
        name: command.parent.name(),
      })
    })

  return program
    .command('completion')
    .description('(Beta) Generate shell completion script\nRun this command to see instructions for your shell.')
    .addExamples(['netlify completion:install'])
    .action((options, command) => {
      command.help()
    })
}
