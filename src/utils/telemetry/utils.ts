import type { GlobalConfigStore } from '@netlify/dev-utils'

import getCLIPackageJson from '../get-cli-package-json.js'

export const { version: cliVersion } = await getCLIPackageJson()

export const isTelemetryDisabled = (config: GlobalConfigStore): boolean => Boolean(config.get('telemetryDisabled'))
