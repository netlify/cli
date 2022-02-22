const execa = require('execa')

const { injectEnvVariables } = require('../../utils')

/**
 * The dev:exec command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const devExec = async (cmd, options, command) => {
  const { cachedConfig, config, site } = command.netlify
  await injectEnvVariables({ devConfig: { ...config.dev }, env: cachedConfig.env, site })

  await execa(cmd, command.args.slice(1), {
    stdio: 'inherit',
  })
}

/**
 * Creates the `netlify dev:exec` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createDevExecCommand = (program) =>
  program
    .command('dev:exec')
    .argument('<...cmd>', `the command that should be executed`)
    .description(
      'Exec command\nRuns a command within the netlify dev environment, e.g. with env variables from any installed addons',
    )
    .allowExcessArguments(true)
    .addExamples(['netlify dev:exec npm run bootstrap'])
    .action(devExec)

module.exports = { createDevExecCommand }
