// @ts-check

const { isEmpty } = require('lodash')

const {
  chalk,
  error: logError,
  log,
  translateFromEnvelopeToMongo,
  translateFromMongoToEnvelope,
} = require('../../utils')

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

  // determine if siteFrom and/or siteTo is on Envelope
  let method
  if (!siteFrom.use_envelope && !siteTo.use_envelope) {
    method = mongoToMongo
  } else if (!siteFrom.use_envelope && siteTo.use_envelope) {
    method = mongoToEnvelope
  } else if (siteFrom.use_envelope && !siteTo.use_envelope) {
    method = envelopeToMongo
  } else {
    method = envelopeToEnvelope
  }
  const success = await method({ api, siteFrom, siteTo })

  if (!success) {
    return false
  }

  log(
    `Successfully migrated environment variables from ${chalk.greenBright(siteFrom.name)} to ${chalk.greenBright(
      siteTo.name,
    )}`,
  )

  return true
}

/**
 * Copies the env from a site not configured with Envelope to a different site not configured with Envelope
 * @returns {Promise<boolean>}
 */
const mongoToMongo = async ({ api, siteFrom, siteTo }) => {
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
    siteId: siteTo.id,
    body: {
      build_settings: {
        env: mergedEnv,
      },
    },
  })

  return true
}

/**
 * Copies the env from a site not configured with Envelope to a site configured with Envelope
 * @returns {Promise<boolean>}
 */
const mongoToEnvelope = async ({ api, siteFrom, siteTo }) => {
  const envFrom = siteFrom.build_settings.env || {}
  const keysFrom = Object.keys(envFrom)

  if (isEmpty(envFrom)) {
    log(`${chalk.greenBright(siteFrom.name)} has no environment variables, nothing to migrate`)
    return false
  }

  const accountId = siteTo.account_slug
  const siteId = siteTo.id

  const envelopeTo = await api.getEnvVars({ accountId, siteId })

  const envVarsToDelete = envelopeTo.filter(({ key }) => keysFrom.includes(key))
  // delete marked env vars in parallel
  await Promise.all(envVarsToDelete.map(({ key }) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  const body = translateFromMongoToEnvelope(envFrom)
  try {
    await api.createEnvVars({ accountId, siteId, body })
  } catch (error) {
    throw error.json ? error.json.msg : error
  }

  return true
}

/**
 * Copies the env from a site configured with Envelope to a site not configured with Envelope
 * @returns {Promise<boolean>}
 */
const envelopeToMongo = async ({ api, siteFrom, siteTo }) => {
  const envelopeVariables = await api.getEnvVars({ accountId: siteFrom.account_slug, siteId: siteFrom.id })
  const envFrom = translateFromEnvelopeToMongo(envelopeVariables)

  if (isEmpty(envFrom)) {
    log(`${chalk.greenBright(siteFrom.name)} has no environment variables, nothing to migrate`)
    return false
  }

  const envTo = siteTo.build_settings.env || {}

  // Merge from site A to site B
  const mergedEnv = {
    ...envTo,
    ...envFrom,
  }

  // Apply environment variable updates
  await api.updateSite({
    siteId: siteTo.id,
    body: {
      build_settings: {
        env: mergedEnv,
      },
    },
  })

  return true
}

/**
 * Copies the env from a site configured with Envelope to a different site configured with Envelope
 * @returns {Promise<boolean>}
 */
const envelopeToEnvelope = async ({ api, siteFrom, siteTo }) => {
  const [envelopeFrom, envelopeTo] = await Promise.all([
    api.getEnvVars({ accountId: siteFrom.account_slug, siteId: siteFrom.id }),
    api.getEnvVars({ accountId: siteTo.account_slug, siteId: siteTo.id }),
  ])

  const keysFrom = envelopeFrom.map(({ key }) => key)

  if (isEmpty(keysFrom)) {
    log(`${chalk.greenBright(siteFrom.name)} has no environment variables, nothing to migrate`)
    return false
  }

  const accountId = siteTo.account_slug
  const siteId = siteTo.id
  const envVarsToDelete = envelopeTo.filter(({ key }) => keysFrom.includes(key))
  // delete marked env vars in parallel
  await Promise.all(envVarsToDelete.map(({ key }) => api.deleteEnvVar({ accountId, siteId, key })))

  // hit create endpoint
  try {
    await api.createEnvVars({ accountId, siteId, body: envelopeFrom })
  } catch (error) {
    throw error.json ? error.json.msg : error
  }

  return true
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
