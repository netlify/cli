// @ts-check
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const { readFile } = require('fs').promises

// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const { get } = require('dot-prop')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const locatePath = require('locate-path')
// @ts-expect-error TS(2580) FIXME: Cannot find name 'require'. Do you need to install... Remove this comment to see the full error message
const nodeVersionAlias = require('node-version-alias')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'warn'.
const { warn } = require('../command-helpers.cjs')

const DEFAULT_NODE_VERSION = '12.18.0'
const NVM_FLAG_PREFIX = '--'

// to support NODE_VERSION=--lts, etc.
const normalizeConfiguredVersion = (version: $TSFixMe) => version.startsWith(NVM_FLAG_PREFIX) ? version.slice(NVM_FLAG_PREFIX.length) : version

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'detectNode... Remove this comment to see the full error message
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

// @ts-expect-error TS(2580) FIXME: Cannot find name 'module'. Do you need to install ... Remove this comment to see the full error message
module.exports = { detectNodeVersion }
