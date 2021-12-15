const { join } = require('path')

const { install, uninstall } = require('tabtab')

const { createAutocompletion } = require('../../lib/completion')

/**
 * The completion:generate command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const completionGenerate = async (options, command) => {
  const { parent } = command

  createAutocompletion(parent)

  await install({
    name: parent.name(),
    completer: join(__dirname, '../../lib/completion/script.js'),
  })

  console.log(`Completion for ${parent.name()} successful installed!`)
}

/**
 * Creates the `netlify completion` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createCompletionCommand = (program) => {
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
module.exports = { createCompletionCommand }
