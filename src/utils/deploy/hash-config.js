import hasha from 'hasha';
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'toml... Remove this comment to see the full error message
import tomlify from 'tomlify-j0.4';
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
export const hashConfig = ({ config }) => {
    if (!config)
        throw new Error('Missing config option');
    const configString = serializeToml(config);
    const hash = hasha(configString, { algorithm: 'sha1' });
    return {
        assetType: 'file',
        body: configString,
        hash,
        normalizedPath: 'netlify.toml',
    };
};
// @ts-expect-error TS(7006) FIXME: Parameter 'object' implicitly has an 'any' type.
export const serializeToml = function (object) {
    return tomlify.toToml(object, { space: 2, replace: replaceTomlValue });
};
// `tomlify-j0.4` serializes integers as floats, e.g. `200.0`.
// This is a problem with `redirects[*].status`.
// @ts-expect-error TS(7006) FIXME: Parameter 'key' implicitly has an 'any' type.
const replaceTomlValue = function (key, value) {
    return Number.isInteger(value) ? String(value) : false;
};
