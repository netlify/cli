import type { GlobalConfigStore } from '@netlify/dev-utils'

import getCLIPackageJson from '../get-cli-package-json.js'

export const { version: cliVersion } = await getCLIPackageJson()

export const isTelemetryDisabled = function (config: GlobalConfigStore): unknown {
  return config.get('telemetryDisabled')
}
