// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'join'.
const { join } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'uninstall'... Remove this comment to see the full error message
const { install, uninstall } = require('tabtab')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createAuto... Remove this comment to see the full error message
const { createAutocompletion } = require('../../lib/completion/index.cjs')

/**
 * The completion:generate command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const completionGenerate = async (options: $TSFixMe, command: $TSFixMe) => {
  const { parent } = command

  createAutocompletion(parent)

  await install({
    name: parent.name(),
    completer: join(__dirname, '../../lib/completion/script.cjs'),
  })

  console.log(`Completion for ${parent.name()} successful installed!`)
}

/**
 * Creates the `netlify completion` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createComp... Remove this comment to see the full error message
const createCompletionCommand = (program: $TSFixMe) => {
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .action(async (options: $TSFixMe, command: $TSFixMe) => {
      await uninstall({
        name: command.parent.name(),
      })
    })

  return program
    .command('completion')
    .description('(Beta) Generate shell completion script\nRun this command to see instructions for your shell.')
    .addExamples(['netlify completion:install'])
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    .action((options: $TSFixMe, command: $TSFixMe) => {
      command.help()
    });
}
module.exports = { createCompletionCommand }
