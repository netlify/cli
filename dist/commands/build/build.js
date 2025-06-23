import { getRunBuildOptions, runBuild } from '../../lib/build.js';
import { detectFrameworkSettings, getDefaultConfig } from '../../utils/build-info.js';
import { logAndThrowError, exit, getToken } from '../../utils/command-helpers.js';
import { getEnvelopeEnv } from '../../utils/env/index.js';
export const checkOptions = ({ cachedConfig: { siteInfo }, token }) => {
    if (!siteInfo.id) {
        return logAndThrowError('Could not find the project ID. If your project is not on Netlify, please run `netlify init` or `netlify deploy` first. If it is, please run `netlify link`.');
    }
    if (!token) {
        return logAndThrowError('Could not find the access token. Please run netlify login.');
    }
};
export const build = async (options, command) => {
    const { cachedConfig, siteInfo } = command.netlify;
    command.setAnalyticsPayload({ dry: options.dry });
    // Retrieve Netlify Build options
    const [token] = await getToken();
    const settings = await detectFrameworkSettings(command, 'build');
    const buildOptions = await getRunBuildOptions({
        cachedConfig,
        defaultConfig: getDefaultConfig(settings),
        packagePath: command.workspacePackage,
        currentDir: command.workingDir,
        token,
        options,
    });
    if (!options.offline) {
        checkOptions(buildOptions);
        buildOptions.cachedConfig.env = await getEnvelopeEnv({
            api: command.netlify.api,
            context: options.context,
            env: buildOptions.cachedConfig.env,
            siteInfo,
        });
    }
    const { exitCode } = await runBuild(buildOptions);
    exit(exitCode);
};
//# sourceMappingURL=build.js.map