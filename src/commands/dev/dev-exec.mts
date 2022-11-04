// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'execa'.
const execa = require('execa')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getEnvelop... Remove this comment to see the full error message
const { getEnvelopeEnv, injectEnvVariables, normalizeContext } = require('../../utils/index.mjs')

/**
 * The dev:exec command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const devExec = async (cmd: $TSFixMe, options: $TSFixMe, command: $TSFixMe) => {
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
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'createDevE... Remove this comment to see the full error message
const createDevExecCommand = (program: $TSFixMe) => program
  .command('dev:exec')
  .argument('<...cmd>', `the command that should be executed`)
  .option(
    '--context <context>',
    'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
    normalizeContext,
    'dev',
  )
  .description(
    'Exec command\nRuns a command within the netlify dev environment, e.g. with env variables from any installed addons',
  )
  .allowExcessArguments(true)
  .addExamples(['netlify dev:exec npm run bootstrap'])
  .action(devExec)

module.exports = { createDevExecCommand }
