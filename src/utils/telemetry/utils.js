import getPackageJson from '../get-package-json.js';
export const { version: cliVersion } = await getPackageJson();
// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const isTelemetryDisabled = function (config) {
    return config.get('telemetryDisabled');
};
