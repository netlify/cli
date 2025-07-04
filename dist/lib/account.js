const supportsBooleanCapability = (account, capability) => Boolean(account?.capabilities?.[capability]?.included);
export const supportsBackgroundFunctions = (account) => supportsBooleanCapability(account, 'background_functions');
//# sourceMappingURL=account.js.map