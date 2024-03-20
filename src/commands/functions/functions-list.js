import AsciiTable from 'ascii-table';
import { exit, log, logJson } from '../../utils/command-helpers.js';
import { getFunctions, getFunctionsDir } from '../../utils/functions/index.js';
// @ts-expect-error TS(7006) FIXME: Parameter 'deployedFunctions' implicitly has an 'a... Remove this comment to see the full error message
const normalizeFunction = function (deployedFunctions, { name, urlPath: url }) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'deployedFunction' implicitly has an 'an... Remove this comment to see the full error message
    const isDeployed = deployedFunctions.some((deployedFunction) => deployedFunction.n === name);
    return { name, url, isDeployed };
};
export const functionsList = async (options, command) => {
    const { config, relConfigFilePath, siteInfo } = command.netlify;
    const deploy = siteInfo.published_deploy || {};
    const deployedFunctions = deploy.available_functions || [];
    // @ts-expect-error TS(2554) FIXME: Expected 2 arguments, but got 1.
    const functionsDir = getFunctionsDir({ options, config });
    if (typeof functionsDir === 'undefined') {
        log('Functions directory is undefined');
        log(`Please verify that 'functions.directory' is set in your Netlify configuration file ${relConfigFilePath}`);
        log('Refer to https://ntl.fyi/file-based-build-config for more information');
        exit(1);
    }
    const functions = await getFunctions(functionsDir);
    const normalizedFunctions = functions.map(normalizeFunction.bind(null, deployedFunctions));
    if (normalizedFunctions.length === 0) {
        log(`No functions found in ${functionsDir}`);
        exit();
    }
    if (options.json) {
        logJson(normalizedFunctions);
        exit();
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
