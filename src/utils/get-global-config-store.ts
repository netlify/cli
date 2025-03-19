import { readFile } from 'fs/promises'

import Configstore from 'configstore'
import { v4 as uuidv4 } from 'uuid'

import { getLegacyPathInHome, getPathInHome } from '../lib/settings.js'

const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

export type GlobalConfigStore = Configstore

// Memoise config result so that we only load it once
let configStore: GlobalConfigStore | undefined

// TODO(serhalp) `Configstore`'s getter and setter are very weakly typed. Use something else
// or wrap with a strongly typed class.
const getGlobalConfigStore = async function (): Promise<GlobalConfigStore> {
  if (!configStore) {
    const configPath = getPathInHome(['config.json'])
    // Legacy config file in home ~/.netlify/config.json
    const legacyPath = getLegacyPathInHome(['config.json'])
    let legacyConfig
    // Read legacy config if exists
    try {
      legacyConfig = JSON.parse(await readFile(legacyPath, { encoding: 'utf8' }))
    } catch {}
    // Use legacy config as default values
    const defaults = { ...globalConfigDefaults, ...legacyConfig }
    // The id param is only used when not passing `configPath` but the type def requires it
    configStore = new Configstore('unused-id', defaults, { configPath })
  }

  return configStore
}

export const resetConfigCache = () => {
  configStore = undefined
}

export default getGlobalConfigStore
