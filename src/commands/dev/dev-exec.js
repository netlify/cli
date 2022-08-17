const { Option } = require('commander')
const execa = require('execa')

const { getEnvelopeEnv, injectEnvVariables } = require('../../utils')

/**
 * The dev:exec command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const devExec = async (cmd, options, command) => {
  const { api, cachedConfig, config, site, siteInfo } = command.netlify

  let { env } = cachedConfig
  if (siteInfo.use_envelope) {
    env = await getEnvelopeEnv({ api, context: options.context, env, siteInfo })
  }

  await injectEnvVariables({ devConfig: { ...config.dev }, env, site })

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
    .addOption(
      new Option('--context <context>', 'Specify a deploy context for environment variables')
        .choices(['production', 'deploy-preview', 'branch-deploy', 'dev'])
        .default('dev'),
    )
    .description(
      'Exec command\nRuns a command within the netlify dev environment, e.g. with env variables from any installed addons',
    )
    .allowExcessArguments(true)
    .addExamples(['netlify dev:exec npm run bootstrap'])
    .action(devExec)

module.exports = { createDevExecCommand }
