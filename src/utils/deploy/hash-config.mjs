import hasha from 'hasha'
import tomlify from 'tomlify-j0.4'

export const hashConfig = ({ config }) => {
  if (!config) throw new Error('Missing config option')
  const configString = serializeToml(config)

  const hash = hasha(configString, { algorithm: 'sha1' })

  return {
    assetType: 'file',
    body: configString,
    hash,
    normalizedPath: 'netlify.toml',
  }
}

export const serializeToml = function (object) {
  return tomlify.toToml(object, { space: 2, replace: replaceTomlValue })
}

// `tomlify-j0.4` serializes integers as floats, e.g. `200.0`.
// This is a problem with `redirects[*].status`.
const replaceTomlValue = function (key, value) {
  return Number.isInteger(value) ? String(value) : false
}
