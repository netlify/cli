// @ts-check

/**
 * @param {any} account
 * @param {string} capability
 * @returns {boolean}
 */
const supportsBooleanCapability = (account, capability) => Boolean(account?.capabilities?.[capability]?.included)

/**
 * @param {any} account
 * @returns {boolean}
 */
export const supportsBackgroundFunctions = (account) => supportsBooleanCapability(account, 'background_functions')
