import { promises } from 'fs'

import Configstore from 'configstore'
import memoizeOne from 'memoize-one'
import { v4 as uuidv4 } from 'uuid'

import { getLegacyPathInHome, getPathInHome } from '../lib/settings.js'

const { readFile } = promises

export const globalConfigDefaults = {
  /* disable stats from being sent to Netlify */
  telemetryDisabled: false,
  /* cliId */
  cliId: uuidv4(),
}

const getGlobalConfigOnce = async function () {
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
  const configStore = new Configstore(null, defaults, { configPath })

  return configStore
}

const getGlobalConfig = async function () {
  const retries = 3
  // eslint-disable-next-line fp/no-loops
  for (let retry = 1; retry <= retries; retry++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await getGlobalConfigOnce()
    } catch (error) {
      if (retry === retries) {
        throw error
      }
    }
  }
}

// Memoise config result so that we only load it once
export default memoizeOne(getGlobalConfig)
