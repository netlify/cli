import getCLIPackageJson from '../get-cli-package-json.js';
export const { version: cliVersion } = await getCLIPackageJson();
// @ts-expect-error TS(7006) FIXME: Parameter 'config' implicitly has an 'any' type.
export const isTelemetryDisabled = function (config) {
    return config.get('telemetryDisabled');
};
//# sourceMappingURL=utils.js.map