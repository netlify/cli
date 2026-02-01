import { createHash } from 'node:crypto'

import tomlify from 'tomlify-j0.4'

import type { NormalizedCachedConfigConfig } from '../command-helpers.js'

export const hashConfig = ({ config }: { config: NormalizedCachedConfigConfig }) => {
  if (!config) throw new Error('Missing config option')
  const configString = serializeToml(config)

  const hash = createHash('sha1').update(configString).digest('hex')

  return {
    assetType: 'file' as const,
    body: configString,
    hash,
    normalizedPath: 'netlify.toml',
  }
}

export const serializeToml = function (object: unknown) {
  return tomlify.toToml(object, { space: 2, replace: replaceTomlValue })
}

const replaceTomlValue = function (key: string, value: unknown) {
  return Number.isInteger(value) ? String(value) : false
}
