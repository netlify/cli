import type { Account, Capability } from '../utils/dev.js'

const supportsBooleanCapability = (account: Account | undefined, capability: Capability) =>
  Boolean(account?.capabilities?.[capability]?.included)

export const supportsBackgroundFunctions = (account?: Account): boolean =>
  supportsBooleanCapability(account, 'background_functions')
