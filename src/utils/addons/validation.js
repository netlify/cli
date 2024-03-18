// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const requiredConfigValues = function (config) {
    return Object.keys(config).filter((key) => config[key].required);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'requiredConfig' implicitly has an 'any'... Remove this comment to see the full error message
export const missingConfigValues = function (requiredConfig, providedConfig) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
    return requiredConfig.filter((key) => !providedConfig[key]);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'allowedConfig' implicitly has an 'any' ... Remove this comment to see the full error message
export const updateConfigValues = function (allowedConfig, currentConfig, newConfig) {
    return Object.keys(allowedConfig).reduce((acc, key) => {
        if (newConfig[key]) {
            // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            acc[key] = newConfig[key];
            return acc;
        }
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[key] = currentConfig[key];
        return acc;
    }, {});
};
