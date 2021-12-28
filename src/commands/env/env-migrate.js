// @ts-check

const { isEmpty } = require('lodash')

const { chalk, error: logError, log } = require('../../utils')

const safeGetSite = async (api, siteId) => {
  try {
    const data = await api.getSite({ siteId })
    return { data }
  } catch (error) {
    return { error }
  }
}

/**
 * The env:migrate command
 * @param {string} siteIdA Site (From)
 * @param {string} siteIdB Site (To)
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envMigrate = async (options, command) => {
  const { api, site } = command.netlify

  if (!site.id && !options.from) {
    log(
      'Please include the source site Id as the `--from` option, or run `netlify link` to link this folder to a Netlify site',
    )
    return false
  }

  const siteId = {
    from: options.from || site.id,
    to: options.to,
  }

  const [{ data: siteFrom, error: errorFrom }, { data: siteTo, error: errorTo }] = await Promise.all([
    safeGetSite(api, siteId.from),
    safeGetSite(api, siteId.to),
  ])

  if (errorFrom) {
    logError(`Can't find site with id ${chalk.bold(siteId.from)}. Please make sure the site exists.`)
    return false
  }

  if (errorTo) {
    logError(`Can't find site with id ${chalk.bold(siteId.to)}. Please make sure the site exists.`)
    return false
  }

  const [
    {
      build_settings: { env: envFrom = {} },
    },
    {
      build_settings: { env: envTo = {} },
    },
  ] = [siteFrom, siteTo]

  if (isEmpty(envFrom)) {
    log(`${chalk.greenBright(siteFrom.name)} has no environment variables, nothing to migrate`)
    return false
  }

  // Merge from site A to site B
  const mergedEnv = {
    ...envTo,
    ...envFrom,
  }

  // Apply environment variable updates
  await api.updateSite({
    siteId: siteId.to,
    body: {
      build_settings: {
        env: mergedEnv,
      },
    },
  })

  log(
    `Successfully migrated environment variables from ${chalk.greenBright(siteFrom.name)} to ${chalk.greenBright(
      siteTo.name,
    )}`,
  )
}

/**
 * Creates the `netlify env:migrate` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvMigrateCommand = (program) =>
  program
    .command('env:migrate')
    .option('-f, --from <from>', 'Site ID (From)')
    .requiredOption('-t, --to <to>', 'Site ID (To)')
    .description(`Migrate environment variables from one site to another`)
    .addExamples([
      'netlify env:migrate --to <to-site-id>',
      'netlify env:migrate --to <to-site-id> --from <from-site-id>',
    ])
    .action(envMigrate)

module.exports = { createEnvMigrateCommand }
