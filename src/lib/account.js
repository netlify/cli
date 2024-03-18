/**
 * @param {any} account
 * @param {string} capability
 * @returns {boolean}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'account' implicitly has an 'any' type.
const supportsBooleanCapability = (account, capability) => Boolean(account?.capabilities?.[capability]?.included);
/**
 * @param {any} account
 * @returns {boolean}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'account' implicitly has an 'any' type.
export const supportsBackgroundFunctions = (account) => supportsBooleanCapability(account, 'background_functions');
