import { createHash } from 'node:crypto'

import tomlify from 'tomlify-j0.4'

import type { InlineUploadFile } from './upload-files.js'

export const hashConfig = ({ config }: { config: object | undefined }): InlineUploadFile & { hash: string } => {
  if (!config) throw new Error('Missing config option')
  const configString = serializeToml(config)

  const hash = createHash('sha1').update(configString).digest('hex')

  return {
    assetType: 'file',
    body: configString,
    hash,
    normalizedPath: 'netlify.toml',
  }
}

export const serializeToml = function (object: object) {
  return tomlify.toToml(object, { space: 2, replace: replaceTomlValue })
}

// `tomlify-j0.4` serializes integers as floats, e.g. `200.0`.
// This is a problem with `redirects[*].status`.
const replaceTomlValue = function (_key: string, value: unknown) {
  return Number.isInteger(value) ? String(value) : false
}
