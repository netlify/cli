// @ts-check

import process from 'process'


const { get } = require('dot-prop')

import getPort from 'get-port'
import jwt from 'jsonwebtoken'

import { isEmpty } from 'lodash'


const { supportsBackgroundFunctions } = require('../lib/account.mjs')


const { NETLIFYDEVLOG, chalk, error, log, warn } = require('./command-helpers.mjs')

const { loadDotEnvFiles } = require('./dot-env.mjs')

// Possible sources of environment variables. For the purpose of printing log messages only. Order does not matter.
const ENV_VAR_SOURCES = {
  account: {
    name: 'shared',
    printFn: chalk.magenta,
  },
  addons: {
    name: 'addon',
    printFn: chalk.yellow,
  },
  configFile: {
    name: 'netlify.toml file',
    printFn: chalk.green,
  },
  general: {
    name: 'general context',
    printFn: chalk.italic,
  },
  process: {
    name: 'process',
    printFn: chalk.red,
  },
  ui: {
    name: 'site settings',
    printFn: chalk.blue,
  },
}

const ERROR_CALL_TO_ACTION =
  "Double-check your login status with 'netlify status' or contact support with details of your error."

const validateSiteInfo = ({
  site,
  siteInfo

}: $TSFixMe) => {
  if (isEmpty(siteInfo)) {
    error(`Failed retrieving site information for site ${chalk.yellow(site.id)}. ${ERROR_CALL_TO_ACTION}`)
  }
}

const getAccounts = async ({
  api

}: $TSFixMe) => {
  try {
    const accounts = await api.listAccountsForUser()
    return accounts
  } catch (error_) {
    
    error(`Failed retrieving user account: ${(error_ as $TSFixMe).message}. ${ERROR_CALL_TO_ACTION}`);
  }
}


const getAddons = async ({
  api,
  site

}: $TSFixMe) => {
  try {
    const addons = await api.listServiceInstancesForSite({ siteId: site.id })
    return addons
  } catch (error_) {
    
    error(`Failed retrieving addons for site ${chalk.yellow(site.id)}: ${(error_ as $TSFixMe).message}. ${ERROR_CALL_TO_ACTION}`);
  }
}

const getAddonsInformation = ({
  addons,
  siteInfo

}: $TSFixMe) => {
  const urls = Object.fromEntries(
    
    addons.map((addon: $TSFixMe) => [addon.service_slug, `${siteInfo.ssl_url}${addon.service_path}`]),
  )
  
  const env = Object.assign({}, ...addons.map((addon: $TSFixMe) => addon.env))
  return { urls, env }
}

const getSiteAccount = ({
  accounts,
  siteInfo

}: $TSFixMe) => {
  
  const siteAccount = accounts.find((account: $TSFixMe) => account.slug === siteInfo.account_slug)
  if (!siteAccount) {
    warn(`Could not find account for site '${siteInfo.name}' with account slug '${siteInfo.account_slug}'`)
    return {}
  }
  return siteAccount
}

// default 10 seconds for synchronous functions
const SYNCHRONOUS_FUNCTION_TIMEOUT = 10

// default 15 minutes for background functions
const BACKGROUND_FUNCTION_TIMEOUT = 900

/**
 *
 * @param {object} config
 * @param {boolean} config.offline
 * @param {*} config.api
 * @param {*} config.site
 * @param {*} config.siteInfo
 * @returns
 */

const getSiteInformation = async ({
  api,
  offline,
  site,
  siteInfo

}: $TSFixMe) => {
  if (site.id && !offline) {
    validateSiteInfo({ site, siteInfo })
    const [accounts, addons] = await Promise.all([getAccounts({ api }), getAddons({ api, site })])

    const { urls: addonsUrls } = getAddonsInformation({ siteInfo, addons })
    const account = getSiteAccount({ siteInfo, accounts })

    return {
      addonsUrls,
      siteUrl: siteInfo.ssl_url,
      capabilities: {
        backgroundFunctions: supportsBackgroundFunctions(account),
      },
      timeouts: {
        syncFunctions: get(siteInfo, 'functions_config.timeout', SYNCHRONOUS_FUNCTION_TIMEOUT),
        backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
      },
    }
  }

  // best defaults we can have without retrieving site information
  return {
    addonsUrls: {},
    siteUrl: '',
    capabilities: {},
    timeouts: {
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    },
  }
}


const getEnvSourceName = (source: $TSFixMe) => {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const { printFn = chalk.green, name = source } = ENV_VAR_SOURCES[source] || {}

  return printFn(name)
}

// Takes a set of environment variables in the format provided by @netlify/config, augments it with variables from both
// dot-env files and the process itself, and injects into `process.env`.

const injectEnvVariables = async ({
  devConfig,
  env,
  site

}: $TSFixMe) => {
  const environment = new Map(Object.entries(env))
  const dotEnvFiles = await loadDotEnvFiles({ envFiles: devConfig.envFiles, projectDir: site.root })

  
  dotEnvFiles.forEach(({ env: fileEnv, file }: $TSFixMe) => {
    Object.keys(fileEnv).forEach((key) => {
        const newSourceName = `${file} file`;
        
        const sources = environment.has(key) ? [newSourceName, ...(environment as $TSFixMe).get(key).sources] : [newSourceName];
        environment.set(key, {
            sources,
            value: fileEnv[key],
        });
    });
});

  // eslint-disable-next-line fp/no-loops
  for (const [key, variable] of environment) {
    const existsInProcess = process.env[key] !== undefined
    
    const [usedSource, ...overriddenSources] = existsInProcess ? ['process', ...(variable as $TSFixMe).sources] : (variable as $TSFixMe).sources;
    const usedSourceName = getEnvSourceName(usedSource)

    
    overriddenSources.forEach((source: $TSFixMe) => {
      const sourceName = getEnvSourceName(source)

      log(
        chalk.dim(
          `${NETLIFYDEVLOG} Ignored ${chalk.bold(sourceName)} env var: ${chalk.yellow(
            key,
          )} (defined in ${usedSourceName})`,
        ),
      )
    })

    if (!existsInProcess) {
      // Omitting `general` env vars to reduce noise in the logs.
      if (usedSource !== 'general') {
        log(`${NETLIFYDEVLOG} Injected ${usedSourceName} env var: ${chalk.yellow(key)}`)
      }

      
      process.env[key] = (variable as $TSFixMe).value;
    }
  }

  process.env.NETLIFY_DEV = 'true'
}


const acquirePort = async ({
  configuredPort,
  defaultPort,
  errorMessage

}: $TSFixMe) => {
  const acquiredPort = await getPort({ port: configuredPort || defaultPort })
  if (configuredPort && acquiredPort !== configuredPort) {
    throw new Error(`${errorMessage}: '${configuredPort}'`)
  }
  return acquiredPort
}

// Generates a Netlify Graph JWT with the following claims:
// - site_id
// - netlify_token -- the bearer token for the Netlify API
// - authlify_token_id -- the authlify token ID stored for the site after
//   enabling API Authentication.

const generateNetlifyGraphJWT = ({
  authlifyTokenId,
  netlifyToken,
  siteId

}: $TSFixMe) => {
  const claims = {
    netlify_token: netlifyToken,
    authlify_token_id: authlifyTokenId,
    site_id: siteId,
  }

  return jwt.sign(
    { 'https://netlify.com/jwt/claims': claims },
    // doesn't matter. OneGraph doesn't check the signature. The presence of
    // the Netlify API bearer token is enough because we've authenticated the
    // user through `command.authenticate()`
    'NOT_SIGNED',
  )
}


const processOnExit = (fn: $TSFixMe) => {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit']
  signals.forEach((signal) => {
    process.on(signal, fn)
  })
}

export default {
  getSiteInformation,
  injectEnvVariables,
  acquirePort,
  generateNetlifyGraphJWT,
  processOnExit,
}
