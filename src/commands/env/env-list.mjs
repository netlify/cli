// @ts-check
import ansiEscapes from 'ansi-escapes'
import AsciiTable from 'ascii-table'
import { isCI } from 'ci-info'
import { Option } from 'commander'
import inquirer from 'inquirer'
import logUpdate from 'log-update'

import { chalk, log, logJson } from '../../utils/command-helpers.mjs'
import { AVAILABLE_CONTEXTS, getEnvelopeEnv, getHumanReadableScopes, normalizeContext } from '../../utils/env/index.mjs'

const MASK_LENGTH = 50
const MASK = '*'.repeat(MASK_LENGTH)

const getTable = ({ environment, hideValues, scopesColumn }) => {
  const table = new AsciiTable(`Environment variables`)
  const headings = ['Key', 'Value', scopesColumn && 'Scope'].filter(Boolean)
  table.setHeading(...headings)
  table.addRowMatrix(
    Object.entries(environment).map(([key, variable]) =>
      [
        // Key
        key,
        // Value
        hideValues ? MASK : variable.value || ' ',
        // Scope
        scopesColumn && getHumanReadableScopes(variable.scopes),
      ].filter(Boolean),
    ),
  )
  return table.toString()
}

/**
 * The env:list command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 * @returns {Promise<boolean>}
 */
const envList = async (options, command) => {
  const { context, scope } = options
  const { api, cachedConfig, site } = command.netlify
  const siteId = site.id

  if (!siteId) {
    log('No site id found, please run inside a site folder or `netlify link`')
    return false
  }

  const { env, siteInfo } = cachedConfig
  let environment = await getEnvelopeEnv({ api, context, env, scope, siteInfo })

  // filter out general sources
  environment = Object.fromEntries(
    Object.entries(environment).filter(([, variable]) => variable.sources[0] !== 'general'),
  )

  // Return json response for piping commands
  if (options.json) {
    const envDictionary = Object.fromEntries(
      Object.entries(environment).map(([key, variable]) => [key, variable.value]),
    )
    logJson(envDictionary)
    return false
  }

  if (options.plain) {
    const plaintext = Object.entries(environment)
      .map(([key, variable]) => `${key}=${variable.value}`)
      .join('\n')
    log(plaintext)
    return false
  }

  const forSite = `for site ${chalk.green(siteInfo.name)}`
  const contextType = AVAILABLE_CONTEXTS.includes(context) ? 'context' : 'branch'
  const withContext = `in the ${chalk.magenta(options.context)} ${contextType}`
  const withScope = scope === 'any' ? '' : `and ${chalk.yellow(options.scope)} scope`
  if (Object.keys(environment).length === 0) {
    log(`No environment variables set ${forSite} ${withContext} ${withScope}`)
    return false
  }

  // List environment in a table
  const count = Object.keys(environment).length
  log(`${count} environment variable${count === 1 ? '' : 's'} ${forSite} ${withContext} ${withScope}`)

  if (isCI) {
    log(getTable({ environment, hideValues: false, scopesColumn: true }))
    return false
  }

  logUpdate(getTable({ environment, hideValues: true, scopesColumn: true }))
  const { showValues } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'showValues',
      message: 'Show values?',
      default: false,
    },
  ])

  if (showValues) {
    // since inquirer adds a prompt, we need to account for it when printing the table again
    log(ansiEscapes.eraseLines(3))
    logUpdate(getTable({ environment, hideValues: false, scopesColumn: true }))
    log(`${chalk.cyan('?')} Show values? ${chalk.cyan('Yes')}`)
  }
}

/**
 * Creates the `netlify env:list` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createEnvListCommand = (program) =>
  program
    .command('env:list')
    .option(
      '-c, --context <context>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      'dev',
    )
    .option('--json', 'Output environment variables as JSON')
    .addOption(new Option('--plain', 'Output environment variables as plaintext').conflicts('json'))
    .addOption(
      new Option('-s, --scope <scope>', 'Specify a scope')
        .choices(['builds', 'functions', 'post-processing', 'runtime', 'any'])
        .default('any'),
    )
    .addExamples([
      'netlify env:list # list variables with values in the dev context and with any scope',
      'netlify env:list --context production',
      'netlify env:list --context branch:staging',
      'netlify env:list --scope functions',
      'netlify env:list --plain',
    ])
    .description('Lists resolved environment variables for site (includes netlify.toml)')
    .action(async (options, command) => {
      await envList(options, command)
    })
