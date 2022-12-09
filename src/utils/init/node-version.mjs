// @ts-check
import { readFile } from 'fs/promises'

import { get } from 'dot-prop'
import locatePath from 'locate-path'
import nodeVersionAlias from 'node-version-alias'

import { warn } from '../command-helpers.mjs'

const DEFAULT_NODE_VERSION = '12.18.0'
const NVM_FLAG_PREFIX = '--'

// to support NODE_VERSION=--lts, etc.
const normalizeConfiguredVersion = (version) =>
  version.startsWith(NVM_FLAG_PREFIX) ? version.slice(NVM_FLAG_PREFIX.length) : version

export const detectNodeVersion = async ({ baseDirectory, env }) => {
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
    warn(`Failed detecting Node.js version: ${error.message}`)
    return DEFAULT_NODE_VERSION
  }
}
