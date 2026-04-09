import { ensureNetlifyIgnore as originalEnsureNetlifyIgnore } from '@netlify/dev-utils'

import { log, warn, logError } from './command-helpers.js'

export const ensureNetlifyIgnore = async (rootDir: string) =>
  originalEnsureNetlifyIgnore(rootDir, { log, warn, error: logError })
