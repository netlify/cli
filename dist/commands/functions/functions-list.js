import AsciiTable from 'ascii-table';
import { exit, log, logJson } from '../../utils/command-helpers.js';
import { getFunctions, getFunctionsDir } from '../../utils/functions/index.js';
const normalizeFunction = function (deployedFunctions, { name, urlPath: url, }) {
    const isDeployed = deployedFunctions.some((deployedFunction) => deployedFunction.n === name);
    return { name, url, isDeployed };
};
export const functionsList = async (options, command) => {
    const { config, relConfigFilePath, siteInfo } = command.netlify;
    // @ts-expect-error FIXME(serhalp): Investigate. This is either dead code or a type error in the API client package.
    const deployedFunctions = siteInfo.published_deploy?.available_functions ?? [];
    const functionsDir = getFunctionsDir({ options, config });
    if (typeof functionsDir === 'undefined') {
        log('Functions directory is undefined');
        log(`Please verify that 'functions.directory' is set in your Netlify configuration file ${relConfigFilePath}`);
        log('Refer to https://ntl.fyi/file-based-build-config for more information');
        return exit(1);
    }
    const functions = await getFunctions(functionsDir);
    const normalizedFunctions = functions.map(normalizeFunction.bind(null, deployedFunctions));
    if (normalizedFunctions.length === 0) {
        log(`No functions found in ${functionsDir}`);
        return exit();
    }
    if (options.json) {
        logJson(normalizedFunctions);
        return exit();
    }
    // Make table
    log(`Based on local functions folder ${functionsDir}, these are the functions detected`);
    const table = new AsciiTable(`Netlify Functions (in local functions folder)`);
    table.setHeading('Name', 'URL', 'deployed');
    normalizedFunctions.forEach(({ isDeployed, name, url }) => {
        table.addRow(name, url, isDeployed ? 'yes' : 'no');
    });
    log(table.toString());
};
//# sourceMappingURL=functions-list.js.map