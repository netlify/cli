import { join } from 'path'

import { OptionValues } from 'commander'

import { getBlobsContextWithEdgeAccess } from '../../lib/blobs/blobs.js'
import { startFunctionsServer } from '../../lib/functions/server.js'
import { printBanner } from '../../utils/dev-server-banner.js'
import { NETLIFYDEVLOG, log } from '../../utils/command-helpers.js'
import {
  UNLINKED_SITE_MOCK_ID,
  acquirePort,
  getDotEnvVariables,
  getSiteInformation,
  injectEnvVariables,
  parseAIGatewayContext,
  setupAIGateway,
} from '../../utils/dev.js'
import { getFunctionsDir } from '../../utils/functions/index.js'
import { getProxyUrl } from '../../utils/proxy.js'
import BaseCommand from '../base-command.js'

const DEFAULT_PORT = 9999

// FIXME(serhalp): Replace `OptionValues` with more specific type. This is full of implicit `any`s.
export const functionsServe = async (options: OptionValues, command: BaseCommand) => {
  const { api, config, site, siteInfo, state } = command.netlify

  const functionsDir = getFunctionsDir({ options, config }, join('netlify', 'functions'))
  let { env } = command.netlify.cachedConfig

  env.NETLIFY_DEV = { sources: ['internal'], value: 'true' }

  env = await getDotEnvVariables({ devConfig: { ...config.dev }, env, site })
  injectEnvVariables(env)

  const { accountId, capabilities, siteUrl, timeouts } = await getSiteInformation({
    offline: options.offline,
    api,
    site,
    siteInfo,
  })

  await setupAIGateway({ api, env, options, site, siteUrl })

  const functionsPort = await acquirePort({
    configuredPort: options.port || config.dev?.functionsPort,
    defaultPort: DEFAULT_PORT,
    errorMessage: 'Could not acquire configured functions port',
  })

  const blobsContext = await getBlobsContextWithEdgeAccess({
    debug: options.debug,
    projectRoot: command.workingDir,
    siteID: site.id ?? UNLINKED_SITE_MOCK_ID,
  })

  const aiGatewayContext = parseAIGatewayContext()

  await startFunctionsServer({
    loadDistFunctions: process.env.NETLIFY_FUNCTIONS_SERVE_LOAD_DIST_FUNCTIONS === 'true',
    aiGatewayContext,
    blobsContext,
    config,
    debug: options.debug,
    command,
    settings: { functions: functionsDir, functionsPort },
    site,
    siteInfo,
    siteUrl,
    capabilities,
    timeouts,
    generatedFunctions: [],
    geolocationMode: options.geo,
    geoCountry: options.country,
    offline: options.offline,
    state,
    accountId,
  })

  const url = getProxyUrl({ port: functionsPort })
  printBanner({ url })
}
