// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'readFile'.
const { readFile } = require('fs').promises

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const Configstore = require('configstore')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const memoizeOne = require('memoize-one')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const { v4: uuidv4 } = require('uuid')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getPathInH... Remove this comment to see the full error message
const { getLegacyPathInHome, getPathInHome } = require('../lib/settings.cjs')

const globalConfigDefaults = {
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

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'getGlobalC... Remove this comment to see the full error message
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

// Memoise config result so that we only load it once
// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = memoizeOne(getGlobalConfig)
