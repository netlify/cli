const { get } = require('dot-prop')
const locatePath = require('locate-path')
const nodeVersionAlias = require('node-version-alias')

const { readFileAsync } = require('../../lib/fs')

const DEFAULT_NODE_VERSION = '12.18.0'
const NVM_FLAG_PREFIX = '--'

// to support NODE_VERSION=--lts, etc.
const normalizeConfiguredVersion = (version) =>
  version.startsWith(NVM_FLAG_PREFIX) ? version.slice(NVM_FLAG_PREFIX.length) : version

const detectNodeVersion = async ({ siteRoot, env, warn }) => {
  try {
    const nodeVersionFile = await locatePath(['.nvmrc', '.node-version'], { cwd: siteRoot })
    const configuredVersion =
      nodeVersionFile === undefined ? get(env, 'NODE_VERSION.value') : await readFileAsync(nodeVersionFile, 'utf8')

    const version =
      configuredVersion === undefined
        ? DEFAULT_NODE_VERSION
        : await nodeVersionAlias(normalizeConfiguredVersion(configuredVersion))

    return version
  } catch (error) {
    warn(`Failed detecting Node.js version: ${error.message}`)
    return DEFAULT_NODE_VERSION
  }
}

module.exports = { detectNodeVersion }
