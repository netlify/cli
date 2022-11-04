const { readFile } = require('fs').promises

const { get } = require('dot-prop')
import locatePath from 'locate-path'
// @ts-ignore
import nodeVersionAlias from 'node-version-alias'

const { warn } = require('../command-helpers.mjs')

const DEFAULT_NODE_VERSION = '12.18.0'
const NVM_FLAG_PREFIX = '--'

// to support NODE_VERSION=--lts, etc.

const normalizeConfiguredVersion = (version: $TSFixMe) => version.startsWith(NVM_FLAG_PREFIX) ? version.slice(NVM_FLAG_PREFIX.length) : version

const detectNodeVersion = async ({
  baseDirectory,
  env

}: $TSFixMe) => {
  try {
    const nodeVersionFile = await locatePath(['.nvmrc', '.node-version'], { cwd: baseDirectory })
    const configuredVersion =
      nodeVersionFile === undefined ? get(env, 'NODE_VERSION.value') : await readFile(nodeVersionFile, 'utf8')

    const version =
      configuredVersion === undefined
        ? DEFAULT_NODE_VERSION
        : await nodeVersionAlias(normalizeConfiguredVersion(configuredVersion))

    return version
  } catch (error) {
    
    warn(`Failed detecting Node.js version: ${(error as $TSFixMe).message}`);
    return DEFAULT_NODE_VERSION
  }
}

export default { detectNodeVersion }
