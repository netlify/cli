import process from 'process'

import type { NetlifyAPI } from '@netlify/api'
import getPort from 'get-port'
import isEmpty from 'lodash/isEmpty.js'

import { supportsBackgroundFunctions } from '../lib/account.js'

import { NETLIFYDEVLOG, chalk, logAndThrowError, log, warn, APIError } from './command-helpers.js'
import { loadDotEnvFiles } from './dot-env.js'
import type { EnvironmentVariables, SiteInfo } from './types.js'

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
    name: 'project settings',
    printFn: chalk.blue,
  },
}

const ERROR_CALL_TO_ACTION =
  "Double-check your login status with 'netlify status' or contact support with details of your error."

const validateSiteInfo = ({ site, siteInfo }: { site: { id?: string }; siteInfo: SiteInfo }) => {
  if (isEmpty(siteInfo)) {
    return logAndThrowError(
      `Failed to retrieve project information for project ${chalk.yellow(site.id)}. ${ERROR_CALL_TO_ACTION}`,
    )
  }
}

type ApiAccount = Awaited<ReturnType<NetlifyAPI['listAccountsForUser']>>[number]
type Capabilities = NonNullable<ApiAccount['capabilities']> & {
  // FIXME(serhalp): `background_functions` is missing from Netlify API account capabilities type
  background_functions?:
    | {
        included?: boolean | undefined
      }
    | undefined
  ai_gateway_disabled?:
    | {
        included?: boolean | undefined
      }
    | undefined
}
export type Capability = keyof Capabilities
export type Account = ApiAccount & {
  capabilities?: Capabilities
}

const getAccounts = async ({ api }: { api: NetlifyAPI }) => {
  try {
    const accounts = await api.listAccountsForUser()
    return accounts
  } catch (error_) {
    return logAndThrowError(`Failed retrieving user account: ${(error_ as APIError).message}. ${ERROR_CALL_TO_ACTION}`)
  }
}

const getAddons = async ({ api, site }: { api: NetlifyAPI; site: { id?: string } }) => {
  try {
    const addons = await api.listServiceInstancesForSite({ siteId: site.id ?? '' })
    return addons
  } catch (error_) {
    return logAndThrowError(
      `Failed retrieving addons for site ${chalk.yellow(site.id)}: ${
        (error_ as APIError).message
      }. ${ERROR_CALL_TO_ACTION}`,
    )
  }
}

type Addon = Awaited<ReturnType<NetlifyAPI['listServiceInstancesForSite']>>[number]

const getAddonsInformation = ({ addons, siteInfo }: { addons: Addon[]; siteInfo: SiteInfo }) => {
  const urls = Object.fromEntries(
    addons.map((addon) => [addon.service_slug, `${siteInfo.ssl_url}${addon.service_path}`]),
  )
  const env = Object.assign({}, ...addons.map((addon) => addon.env))
  return { urls, env }
}

const getSiteAccount = ({ accounts, siteInfo }: { accounts: Account[]; siteInfo: SiteInfo }): Account | undefined => {
  const siteAccount = accounts.find((account) => account.slug === siteInfo.account_slug)
  if (!siteAccount) {
    warn(`Could not find account for project '${siteInfo.name}' with account slug '${siteInfo.account_slug}'`)
    return undefined
  }
  return siteAccount
}

// default 10 seconds for synchronous functions
const SYNCHRONOUS_FUNCTION_TIMEOUT = 30

// default 15 minutes for background functions
const BACKGROUND_FUNCTION_TIMEOUT = 900

interface GetSiteInformationOptions {
  api: NetlifyAPI
  offline: boolean
  site: { id?: string }
  siteInfo: SiteInfo
}

export interface SiteInformationResult {
  addonsUrls: Record<string, string>
  siteUrl: string
  accountId?: string
  capabilities: {
    backgroundFunctions?: boolean
    aiGatewayDisabled: boolean
  }
  timeouts: {
    syncFunctions: number
    backgroundFunctions: number
  }
}

export const getSiteInformation = async ({
  api,
  offline,
  site,
  siteInfo,
}: GetSiteInformationOptions): Promise<SiteInformationResult> => {
  if (site.id && !offline) {
    validateSiteInfo({ site, siteInfo })
    const [accounts, addons] = await Promise.all([getAccounts({ api }), getAddons({ api, site })])

    const { urls: addonsUrls } = getAddonsInformation({ siteInfo, addons })
    const account = getSiteAccount({ siteInfo, accounts })

    return {
      addonsUrls,
      siteUrl: siteInfo.ssl_url,
      accountId: account?.id,
      capabilities: {
        backgroundFunctions: supportsBackgroundFunctions(account),
        aiGatewayDisabled: siteInfo.capabilities?.ai_gateway_disabled ?? false,
      },
      timeouts: {
        syncFunctions: siteInfo.functions_timeout ?? siteInfo.functions_config?.timeout ?? SYNCHRONOUS_FUNCTION_TIMEOUT,
        backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
      },
    }
  }

  // best defaults we can have without retrieving site information
  return {
    addonsUrls: {},
    siteUrl: '',
    capabilities: {
      aiGatewayDisabled: false,
    },
    timeouts: {
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    },
  }
}

const getEnvSourceName = (source: string) => {
  const sourceConfig = (
    ENV_VAR_SOURCES as Record<string, { name: string; printFn: (s: string) => string } | undefined>
  )[source]
  const { name = source, printFn = chalk.green } = sourceConfig || {}

  return printFn(name)
}

/**
 * @param {{devConfig: any, env: Record<string, { sources: string[], value: string}>, site: any}} param0
 */
export const getDotEnvVariables = async ({
  devConfig,
  env,
  site,
}: {
  devConfig: { envFiles?: string[]; env_files?: string[]; [key: string]: unknown }
  env: EnvironmentVariables
  site: { root?: string; [key: string]: unknown }
}): Promise<EnvironmentVariables> => {
  const { root } = site
  if (!root) {
    return env
  }
  const envFiles = devConfig.envFiles || devConfig.env_files
  const dotEnvFiles = await loadDotEnvFiles({ envFiles, projectDir: root })
  dotEnvFiles.forEach(({ env: fileEnv, file }) => {
    const newSourceName = `${file} file`

    Object.keys(fileEnv).forEach((key) => {
      const sources = key in env ? [newSourceName, ...env[key].sources] : [newSourceName]

      if (sources.includes('internal')) {
        return
      }

      env[key] = {
        sources,
        value: fileEnv[key],
      }
    })
  })

  return env
}

/**
 * Takes a set of environment variables in the format provided by @netlify/config and injects them into `process.env`
 */
export const injectEnvVariables = (env: EnvironmentVariables): void => {
  const envVarsToLogByUsedSource: Record<string, string[]> = {}
  for (const [key, variable] of Object.entries(env)) {
    const existsInProcess = process.env[key] !== undefined
    const [usedSource, ...overriddenSources] = existsInProcess ? ['process', ...variable.sources] : variable.sources
    const usedSourceName = getEnvSourceName(usedSource)
    const isInternal = variable.sources.includes('internal')

    overriddenSources.forEach((source) => {
      const sourceName = getEnvSourceName(source)

      log(
        chalk.dim(
          `${NETLIFYDEVLOG} Ignored ${chalk.bold(sourceName)} env var: ${chalk.yellow(
            key,
          )} (defined in ${usedSourceName})`,
        ),
      )
    })

    if (!existsInProcess || isInternal) {
      // Omitting `general` and `internal` env vars to reduce noise in the logs.
      if (usedSource !== 'general' && !isInternal) {
        envVarsToLogByUsedSource[usedSource] ??= []
        envVarsToLogByUsedSource[usedSource].push(key)
      }

      process.env[key] = variable.value
    }
  }

  for (const [source, keys] of Object.entries(envVarsToLogByUsedSource)) {
    const sourceName = getEnvSourceName(source)
    log(`${NETLIFYDEVLOG} Injected ${sourceName} env vars: ${keys.map((key) => chalk.yellow(key)).join(', ')}`)
  }
}

export const acquirePort = async ({
  configuredPort,
  defaultPort,
  errorMessage,
}: {
  configuredPort?: number
  defaultPort: number
  errorMessage: string
}) => {
  const acquiredPort = await getPort({ port: configuredPort || defaultPort })
  if (configuredPort && acquiredPort !== configuredPort) {
    throw new Error(`${errorMessage}: '${configuredPort}'`)
  }
  return acquiredPort
}

export const processOnExit = (fn: (codeOrSignal: string | number) => void | Promise<void>) => {
  const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit']
  signals.forEach((signal) => {
    process.on(signal, (codeOrSignal) => {
      void fn(codeOrSignal)
    })
  })
}

export const UNLINKED_SITE_MOCK_ID = 'unlinked'
