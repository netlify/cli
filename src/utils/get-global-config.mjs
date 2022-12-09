import { readFile } from 'fs/promises'

import Configstore from 'configstore'
import { v4 as uuidv4 } from 'uuid'

import { getLegacyPathInHome, getPathInHome } from '../lib/settings.cjs'

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

// Memoise config result so that we only load it once
let configStore

const getGlobalConfigOnce = async function () {
  if (!configStore) {
    const configPath = getPathInHome(['config.json'])
    // Legacy config file in home ~/.netlify/config.json
    const legacyPath = getLegacyPathInHome(['config.json'])
    let legacyConfig
    // Read legacy config if exists
    try {
      legacyConfig = JSON.parse(await readFile(legacyPath))
    } catch {}
    // Use legacy config as default values
    const defaults = { ...globalConfigDefaults, ...legacyConfig }
    configStore = new Configstore(null, defaults, { configPath })
  }

  return configStore
}

const getGlobalConfig = async function () {
  const retries = 3
  // eslint-disable-next-line fp/no-loops
  for (let retry = 1; retry <= retries; retry++) {
    try {
      return await getGlobalConfigOnce()
    } catch (error) {
      if (retry === retries) {
        throw error
      }
    }
  }
}

export const resetConfigCache = () => {
  configStore = undefined
}

export default getGlobalConfig
