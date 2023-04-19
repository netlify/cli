import getPackageJson from '../get-package-json.mjs'

export const { version: cliVersion } = await getPackageJson()

export const isTelemetryDisabled = function (config) {
  return config.get('telemetryDisabled')
}
