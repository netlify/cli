import { exit, log, NETLIFYDEVERR } from './command-helpers.js';
import { startProxy } from './proxy.js';
export const generateInspectSettings = (edgeInspect, edgeInspectBrk) => {
    const enabled = Boolean(edgeInspect) || Boolean(edgeInspectBrk);
    const pause = Boolean(edgeInspectBrk);
    const getAddress = () => {
        if (edgeInspect) {
            return typeof edgeInspect === 'string' ? edgeInspect : undefined;
        }
        if (edgeInspectBrk) {
            return typeof edgeInspectBrk === 'string' ? edgeInspectBrk : undefined;
        }
    };
    return {
        enabled,
        pause,
        address: getAddress(),
    };
};
export const startProxyServer = async ({ accountId, addonsUrls, api, blobsContext, command, config, configPath, debug, disableEdgeFunctions, env, functionsRegistry, geoCountry, geolocationMode, getUpdatedConfig, inspectSettings, offline, projectDir, repositoryRoot, settings, site, siteInfo, state, }) => {
    const url = await startProxy({
        addonsUrls,
        blobsContext,
        command,
        config,
        configPath: configPath || site.configPath,
        debug,
        disableEdgeFunctions,
        env,
        functionsRegistry,
        geolocationMode,
        geoCountry,
        getUpdatedConfig,
        inspectSettings,
        offline,
        projectDir,
        settings,
        state,
        siteInfo,
        accountId,
        repositoryRoot,
        api,
    });
    if (!url) {
        log(NETLIFYDEVERR, `Unable to start proxy server on port '${settings.port}'`);
        exit(1);
    }
    return url;
};
//# sourceMappingURL=proxy-server.js.map