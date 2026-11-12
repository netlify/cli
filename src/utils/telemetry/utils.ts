import process from 'process'

import getCLIPackageJson from '../get-cli-package-json.js'

export const { version: cliVersion } = await getCLIPackageJson()

// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const isTelemetryDisabled = function (config) {
  return config.get('telemetryDisabled')
}

const isEnabledFlag = (value: string | undefined) => value !== undefined && !['', '0', 'false'].includes(value)

// An env var opt-out matters in CI, where the global config written by `--telemetry-disable` rarely persists.
export const isTelemetryDisabledByEnv = () =>
  isEnabledFlag(process.env.NETLIFY_TELEMETRY_DISABLED) || isEnabledFlag(process.env.DO_NOT_TRACK)
