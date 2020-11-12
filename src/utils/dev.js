const process = require('process')

const fromEntries = require('@ungap/from-entries')
const chalk = require('chalk')
const isEmpty = require('lodash/isEmpty')

const { supportsBackgroundFunctions } = require('../lib/account')

const { loadDotEnvFiles } = require('./dot-env')
const { NETLIFYDEVLOG } = require('./logo')

const ERROR_CALL_TO_ACTION =
  "Double-check your login status with 'netlify status' or contact support with details of your error."

const validateSiteInfo = ({ site, siteInfo, failAndExit }) => {
  if (isEmpty(siteInfo)) {
    failAndExit(`Failed retrieving site information for site ${chalk.yellow(site.id)}. ${ERROR_CALL_TO_ACTION}`)
  }
}

const getAccounts = async ({ api, failAndExit }) => {
  try {
    const accounts = await api.listAccountsForUser()
    return accounts
  } catch (error) {
    failAndExit(`Failed retrieving user account: ${error.message}. ${ERROR_CALL_TO_ACTION}`)
  }
}

const getAddons = async ({ api, site, failAndExit }) => {
  try {
    const addons = await api.listServiceInstancesForSite({ siteId: site.id })
    return addons
  } catch (error) {
    failAndExit(`Failed retrieving addons for site ${chalk.yellow(site.id)}: ${error.message}. ${ERROR_CALL_TO_ACTION}`)
  }
}

const getAddonsInformation = ({ siteInfo, addons }) => {
  const urls = fromEntries(addons.map((addon) => [addon.service_slug, `${siteInfo.ssl_url}${addon.service_path}`]))
  const env = Object.assign({}, ...addons.map((addon) => addon.env))
  return { urls, env }
}

const getSiteAccount = ({ siteInfo, accounts, warn }) => {
  const siteAccount = accounts.find((account) => account.slug === siteInfo.account_slug)
  if (!siteAccount) {
    warn(`Could not find account for site '${siteInfo.name}' with account slug '${siteInfo.account_slug}'`)
    return {}
  }
  return siteAccount
}

const getTeamEnv = ({ account }) => {
  if (account.site_env) {
    return account.site_env
  }
  return {}
}

const getSiteEnv = ({ siteInfo }) => {
  if (siteInfo.build_settings && siteInfo.build_settings.env) {
    return siteInfo.build_settings.env
  }
  return {}
}

const getSiteInformation = async ({ flags = {}, api, site, warn, error: failAndExit, siteInfo }) => {
  if (site.id && !flags.offline) {
    validateSiteInfo({ site, siteInfo, failAndExit })
    const [accounts, addons, dotFilesEnv] = await Promise.all([
      getAccounts({ api, failAndExit }),
      getAddons({ api, site, failAndExit }),
      loadDotEnvFiles({ projectDir: site.root, warn }),
    ])

    const { urls: addonsUrls, env: addonsEnv } = getAddonsInformation({ siteInfo, addons })
    const account = getSiteAccount({ siteInfo, accounts, warn })
    const teamEnv = getTeamEnv({ account })
    const siteEnv = getSiteEnv({ siteInfo })

    return {
      addonsUrls,
      teamEnv,
      addonsEnv,
      siteEnv,
      dotFilesEnv,
      siteUrl: siteInfo.ssl_url,
      capabilities: {
        backgroundFunctions: supportsBackgroundFunctions(account),
      },
    }
  }

  const dotFilesEnv = await loadDotEnvFiles({ projectDir: site.root, warn })
  return { addonsUrls: {}, teamEnv: {}, addonsEnv: {}, siteEnv: {}, dotFilesEnv, siteUrl: '', capabilities: {} }
}

// if first arg is undefined, use default, but tell user about it in case it is unintentional
const assignLoudly = function (optionalValue, defaultValue, tellUser) {
  if (defaultValue === undefined) throw new Error('must have a defaultValue')
  if (defaultValue !== optionalValue && optionalValue === undefined) {
    tellUser(defaultValue)
    return defaultValue
  }
  return optionalValue
}

const addEnvVariables = ({ log, teamEnv, addonsEnv, siteEnv, dotFilesEnv }) => {
  for (const { file, env } of dotFilesEnv) {
    for (const key in env) {
      const msg = () =>
        log(`${NETLIFYDEVLOG} Injected ${chalk.green.bold(`${file} file`)} env var: ${chalk.yellow(key)}`)
      process.env[key] = assignLoudly(process.env[key], env[key], msg)
    }
  }

  for (const key in siteEnv) {
    const msg = () => log(`${NETLIFYDEVLOG} Injected ${chalk.blue.bold('build setting')} env var: ${chalk.yellow(key)}`)
    process.env[key] = assignLoudly(process.env[key], siteEnv[key], msg)
  }

  for (const key in addonsEnv) {
    const msg = () => log(`${NETLIFYDEVLOG} Injected ${chalk.yellow.bold('addon')} env var: ${chalk.yellow(key)}`)
    process.env[key] = assignLoudly(process.env[key], addonsEnv[key], msg)
  }

  for (const key in teamEnv) {
    const msg = () =>
      log(`${NETLIFYDEVLOG} Injected ${chalk.magenta.bold('shared build setting')} env var: ${chalk.yellow(key)}`)
    process.env[key] = assignLoudly(process.env[key], teamEnv[key], msg)
  }

  process.env.NETLIFY_DEV = 'true'
}

module.exports = {
  getSiteInformation,
  addEnvVariables,
}
