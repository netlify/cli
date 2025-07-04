import { stat } from 'fs/promises';
import { basename, resolve } from 'path';
import { runCoreSteps } from '@netlify/build';
import inquirer from 'inquirer';
import isEmpty from 'lodash/isEmpty.js';
import isObject from 'lodash/isObject.js';
import { parseAllHeaders } from '@netlify/headers-parser';
import { parseAllRedirects } from '@netlify/redirect-parser';
import prettyjson from 'prettyjson';
import { cancelDeploy } from '../../lib/api.js';
import { getRunBuildOptions, runBuild, } from '../../lib/build.js';
import { getBootstrapURL } from '../../lib/edge-functions/bootstrap.js';
import { featureFlags as edgeFunctionsFeatureFlags } from '../../lib/edge-functions/consts.js';
import { normalizeFunctionsConfig } from '../../lib/functions/config.js';
import { BACKGROUND_FUNCTIONS_WARNING } from '../../lib/log.js';
import { startSpinner, stopSpinner } from '../../lib/spinner.js';
import { detectFrameworkSettings, getDefaultConfig } from '../../utils/build-info.js';
import { NETLIFY_CYAN_HEX, NETLIFYDEVERR, NETLIFYDEVLOG, chalk, logAndThrowError, exit, getToken, log, logJson, warn, } from '../../utils/command-helpers.js';
import { DEFAULT_DEPLOY_TIMEOUT } from '../../utils/deploy/constants.js';
import { deploySite } from '../../utils/deploy/deploy-site.js';
import { getEnvelopeEnv } from '../../utils/env/index.js';
import { getFunctionsManifestPath, getInternalFunctionsDir } from '../../utils/functions/index.js';
import openBrowser from '../../utils/open-browser.js';
import { link } from '../link/link.js';
import { sitesCreate } from '../sites/sites-create.js';
import boxen from 'boxen';
import terminalLink from 'terminal-link';
const triggerDeploy = async ({ api, options, siteData, siteId, }) => {
    try {
        const siteBuild = await api.createSiteBuild({ siteId });
        if (options.json) {
            logJson({
                site_id: siteId,
                site_name: siteData.name,
                deploy_id: `${siteBuild.deploy_id}`,
                logs: `https://app.netlify.com/projects/${siteData.name}/deploys/${siteBuild.deploy_id}`,
            });
        }
        else {
            log(`${NETLIFYDEVLOG} A new deployment was triggered successfully. Visit https://app.netlify.com/projects/${siteData.name}/deploys/${siteBuild.deploy_id} to see the logs.`);
        }
    }
    catch (error_) {
        if (error_.status === 404) {
            return logAndThrowError('Project not found. Please rerun "netlify link" and make sure that your project has CI configured.');
        }
        else {
            return logAndThrowError(error_.message);
        }
    }
};
/** Retrieves the folder containing the static files that need to be deployed */
const getDeployFolder = async ({ command, config, options, site, siteData, }) => {
    let deployFolder;
    // if the `--dir .` flag is provided we should resolve it to the working directory.
    // - in regular sites this is the `process.cwd`
    // - in mono repositories this will be the root of the jsWorkspace
    if (options.dir) {
        deployFolder = command.workspacePackage
            ? resolve(command.jsWorkspaceRoot || site.root, options.dir)
            : resolve(command.workingDir, options.dir);
    }
    else if (config?.build?.publish) {
        deployFolder = resolve(site.root, config.build.publish);
    }
    else if (siteData?.build_settings?.dir) {
        deployFolder = resolve(site.root, siteData.build_settings.dir);
    }
    if (!deployFolder) {
        log('Please provide a publish directory (e.g. "public" or "dist" or "."):');
        const { promptPath } = await inquirer.prompt([
            {
                type: 'input',
                name: 'promptPath',
                message: 'Publish directory',
                default: '.',
                filter: (input) => resolve(command.workingDir, input),
            },
        ]);
        deployFolder = promptPath;
    }
    return deployFolder;
};
const validateDeployFolder = async (deployFolder) => {
    let stats;
    try {
        stats = await stat(deployFolder);
    }
    catch (error_) {
        if (error_ && typeof error_ === 'object' && 'code' in error_) {
            if (error_.code === 'ENOENT') {
                return logAndThrowError(`The deploy directory "${deployFolder}" has not been found. Did you forget to run 'netlify build'?`);
            }
            // Improve the message of permission errors
            if (error_.code === 'EACCES') {
                return logAndThrowError('Permission error when trying to access deploy folder');
            }
        }
        throw error_;
    }
    if (!stats.isDirectory()) {
        return logAndThrowError('Deploy target must be a path to a directory');
    }
    return stats;
};
/** get the functions directory */
const getFunctionsFolder = ({ config, options, site, siteData, workingDir, }) => {
    let functionsFolder;
    // Support "functions" and "Functions"
    const funcConfig = config.functionsDirectory;
    if (options.functions) {
        functionsFolder = resolve(workingDir, options.functions);
    }
    else if (funcConfig) {
        functionsFolder = resolve(site.root, funcConfig);
    }
    else if (siteData?.build_settings?.functions_dir) {
        functionsFolder = resolve(site.root, siteData.build_settings.functions_dir);
    }
    return functionsFolder;
};
const validateFunctionsFolder = async (functionsFolder) => {
    let stats;
    if (functionsFolder) {
        // we used to hard error if functions folder is specified but doesn't exist
        // but this was too strict for onboarding. we can just log a warning.
        try {
            stats = await stat(functionsFolder);
        }
        catch (error_) {
            if (error_ && typeof error_ === 'object' && 'code' in error_) {
                if (error_.code === 'ENOENT') {
                    log(`Functions folder "${functionsFolder}" specified but it doesn't exist! Will proceed without deploying functions`);
                }
                // Improve the message of permission errors
                if (error_.code === 'EACCES') {
                    return logAndThrowError('Permission error when trying to access functions folder');
                }
            }
        }
    }
    if (stats && !stats.isDirectory()) {
        return logAndThrowError('Functions folder must be a path to a directory');
    }
    return stats;
};
const validateFolders = async ({ deployFolder, functionsFolder, }) => {
    const deployFolderStat = await validateDeployFolder(deployFolder);
    const functionsFolderStat = await validateFunctionsFolder(functionsFolder);
    return { deployFolderStat, functionsFolderStat };
};
/**
 * @param {object} config
 * @param {string} config.deployFolder
 * @param {*} config.site
 * @returns
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'deployFolder' implicitly has an '... Remove this comment to see the full error message
const getDeployFilesFilter = ({ deployFolder, site }) => {
    // site.root === deployFolder can happen when users run `netlify deploy --dir .`
    // in that specific case we don't want to publish the repo node_modules
    // when site.root !== deployFolder the behaviour matches our buildbot
    const skipNodeModules = site.root === deployFolder;
    return (filename) => {
        if (filename == null) {
            return false;
        }
        if (filename === deployFolder) {
            return true;
        }
        const base = basename(filename);
        const skipFile = (skipNodeModules && base === 'node_modules') ||
            (base.startsWith('.') && base !== '.well-known') ||
            base.startsWith('__MACOSX') ||
            base.includes('/.') ||
            // headers and redirects are bundled in the config
            base === '_redirects' ||
            base === '_headers';
        return !skipFile;
    };
};
const SEC_TO_MILLISEC = 1e3;
// 100 bytes
const SYNC_FILE_LIMIT = 1e2;
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
const prepareProductionDeploy = async ({ api, siteData }) => {
    if (isObject(siteData.published_deploy) && siteData.published_deploy.locked) {
        log(`\n${NETLIFYDEVERR} Deployments are "locked" for production context of this project\n`);
        const { unlockChoice } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'unlockChoice',
                message: 'Would you like to "unlock" deployments for production context to proceed?',
                default: false,
            },
        ]);
        if (!unlockChoice)
            exit(0);
        await api.unlockDeploy({ deploy_id: siteData.published_deploy.id });
        log(`\n${NETLIFYDEVLOG} "Auto publishing" has been enabled for production context\n`);
    }
};
// @ts-expect-error TS(7006) FIXME: Parameter 'actual' implicitly has an 'any' type.
const hasErrorMessage = (actual, expected) => {
    if (typeof actual === 'string') {
        return actual.includes(expected);
    }
    return false;
};
// @ts-expect-error TS(7031) FIXME: Binding element 'error_' implicitly has an 'any' t... Remove this comment to see the full error message
const reportDeployError = ({ error_, failAndExit }) => {
    switch (true) {
        case error_.name === 'JSONHTTPError': {
            const message = error_?.json?.message ?? '';
            if (hasErrorMessage(message, 'Background Functions not allowed by team plan')) {
                return failAndExit(`\n${BACKGROUND_FUNCTIONS_WARNING}`);
            }
            warn(`JSONHTTPError: ${message} ${error_.status}`);
            warn(`\n${JSON.stringify(error_, null, '  ')}\n`);
            failAndExit(error_);
            return;
        }
        case error_.name === 'TextHTTPError': {
            warn(`TextHTTPError: ${error_.status}`);
            warn(`\n${error_}\n`);
            failAndExit(error_);
            return;
        }
        case hasErrorMessage(error_.message, 'Invalid filename'): {
            warn(error_.message);
            failAndExit(error_);
            return;
        }
        default: {
            warn(`\n${JSON.stringify(error_, null, '  ')}\n`);
            failAndExit(error_);
        }
    }
};
const deployProgressCb = function () {
    const spinnersByType = {};
    return (event) => {
        switch (event.phase) {
            case 'start': {
                spinnersByType[event.type] = startSpinner({
                    text: event.msg,
                });
                return;
            }
            case 'progress': {
                const spinner = spinnersByType[event.type];
                if (spinner) {
                    spinner.update({ text: event.msg });
                }
                return;
            }
            case 'error':
                stopSpinner({ error: true, spinner: spinnersByType[event.type], text: event.msg });
                delete spinnersByType[event.type];
                return;
            case 'stop':
            default: {
                spinnersByType[event.type].success(event.msg);
                delete spinnersByType[event.type];
            }
        }
    };
};
const uploadDeployBlobs = async ({ cachedConfig, deployId, options, packagePath, silent, siteId, }) => {
    const statusCb = silent ? () => { } : deployProgressCb();
    statusCb({
        type: 'blobs-uploading',
        msg: 'Uploading blobs to deploy store...\n',
        phase: 'start',
    });
    const [token] = await getToken();
    const blobsToken = token || undefined;
    const { success } = await runCoreSteps(['blobs_upload'], {
        ...options,
        // We log our own progress so we don't want this as well. Plus, this logs much of the same
        // information as the build that (likely) came before this as part of the deploy build.
        quiet: options.debug ?? true,
        // @ts-expect-error(serhalp) -- Untyped in `@netlify/build`
        cachedConfig,
        packagePath,
        deployId,
        siteId,
        token: blobsToken,
    });
    if (!success) {
        statusCb({
            type: 'blobs-uploading',
            msg: 'Deploy aborted due to error while uploading blobs to deploy store',
            phase: 'error',
        });
        return logAndThrowError('Error while uploading blobs to deploy store');
    }
    statusCb({
        type: 'blobs-uploading',
        msg: 'Finished uploading blobs to deploy store',
        phase: 'stop',
    });
};
const runDeploy = async ({ 
// @ts-expect-error TS(7031) FIXME: Binding element 'alias' implicitly has an 'any' ty... Remove this comment to see the full error message
alias, 
// @ts-expect-error TS(7031) FIXME: Binding element 'api' implicitly has an 'any' type... Remove this comment to see the full error message
api, command, 
// @ts-expect-error TS(7031) FIXME: Binding element 'config' implicitly has an 'any' t... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(7031) FIXME: Binding element 'deployFolder' implicitly has an '... Remove this comment to see the full error message
deployFolder, 
// @ts-expect-error TS(7031) FIXME: Binding element 'deployTimeout' implicitly has an ... Remove this comment to see the full error message
deployTimeout, 
// @ts-expect-error TS(7031) FIXME: Binding element 'deployToProduction' implicitly ha... Remove this comment to see the full error message
deployToProduction, 
// @ts-expect-error TS(7031) FIXME: Binding element 'functionsConfig' implicitly has a... Remove this comment to see the full error message
functionsConfig, functionsFolder, 
// @ts-expect-error TS(7031) FIXME: Binding element 'options' implicitly has an 'a... Remove this comment to see the full error message
options, 
// @ts-expect-error TS(7031) FIXME: Binding element 'packagePath' implicitly has an 'a... Remove this comment to see the full error message
packagePath, 
// @ts-expect-error TS(7031) FIXME: Binding element 'silent' implicitly has an 'any' t... Remove this comment to see the full error message
silent, 
// @ts-expect-error TS(7031) FIXME: Binding element 'site' implicitly has an 'any' typ... Remove this comment to see the full error message
site, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteData' implicitly has an 'any'... Remove this comment to see the full error message
siteData, 
// @ts-expect-error TS(7031) FIXME: Binding element 'siteId' implicitly has an 'any' t... Remove this comment to see the full error message
siteId, 
// @ts-expect-error TS(7031) FIXME: Binding element 'skipFunctionsCache' implicitly ha... Remove this comment to see the full error message
skipFunctionsCache, 
// @ts-expect-error TS(7031) FIXME: Binding element 'title' implicitly has an 'any' ty... Remove this comment to see the full error message
title, }) => {
    let results;
    let deployId;
    try {
        if (deployToProduction) {
            await prepareProductionDeploy({ siteData, api });
        }
        const draft = !deployToProduction && !alias;
        results = await api.createSiteDeploy({ siteId, title, body: { draft, branch: alias } });
        deployId = results.id;
        const internalFunctionsFolder = await getInternalFunctionsDir({ base: site.root, packagePath, ensureExists: true });
        await command.netlify.frameworksAPIPaths.functions.ensureExists();
        // The order of the directories matter: zip-it-and-ship-it will prioritize
        // functions from the rightmost directories. In this case, we want user
        // functions to take precedence over internal functions.
        const functionDirectories = [
            internalFunctionsFolder,
            command.netlify.frameworksAPIPaths.functions.path,
            functionsFolder,
        ].filter((folder) => Boolean(folder));
        const manifestPath = skipFunctionsCache ? null : await getFunctionsManifestPath({ base: site.root, packagePath });
        const redirectsPath = `${deployFolder}/_redirects`;
        const headersPath = `${deployFolder}/_headers`;
        const { redirects } = await parseAllRedirects({
            configRedirects: config.redirects,
            redirectsFiles: [redirectsPath],
            minimal: true,
        });
        config.redirects = redirects;
        const { headers } = await parseAllHeaders({
            configHeaders: config.headers,
            headersFiles: [headersPath],
            minimal: true,
        });
        config.headers = headers;
        await uploadDeployBlobs({
            deployId,
            siteId,
            silent,
            options,
            cachedConfig: command.netlify.cachedConfig,
            packagePath: command.workspacePackage,
        });
        results = await deploySite(command, api, siteId, deployFolder, {
            // @ts-expect-error FIXME
            config,
            fnDir: functionDirectories,
            functionsConfig,
            statusCb: silent ? () => { } : deployProgressCb(),
            deployTimeout,
            syncFileLimit: SYNC_FILE_LIMIT,
            // pass an existing deployId to update
            deployId,
            filter: getDeployFilesFilter({ site, deployFolder }),
            workingDir: command.workingDir,
            manifestPath,
            skipFunctionsCache,
            siteRoot: site.root,
        });
    }
    catch (error_) {
        if (deployId) {
            await cancelDeploy({ api, deployId });
        }
        reportDeployError({ error_, failAndExit: logAndThrowError });
    }
    const siteUrl = results.deploy.ssl_url || results.deploy.url;
    const deployUrl = results.deploy.deploy_ssl_url || results.deploy.deploy_url;
    const logsUrl = `${results.deploy.admin_url}/deploys/${results.deploy.id}`;
    let functionLogsUrl = `${results.deploy.admin_url}/logs/functions`;
    let edgeFunctionLogsUrl = `${results.deploy.admin_url}/logs/edge-functions`;
    if (!deployToProduction) {
        functionLogsUrl += `?scope=deploy:${deployId}`;
        edgeFunctionLogsUrl += `?scope=deployid:${deployId}`;
    }
    return {
        siteId: results.deploy.site_id,
        siteName: results.deploy.name,
        deployId: results.deployId,
        siteUrl,
        deployUrl,
        logsUrl,
        functionLogsUrl,
        edgeFunctionLogsUrl,
    };
};
const handleBuild = async ({ cachedConfig, currentDir, defaultConfig, deployHandler, options, packagePath, }) => {
    if (!options.build) {
        return {};
    }
    const [token] = await getToken();
    const resolvedOptions = await getRunBuildOptions({
        cachedConfig,
        defaultConfig,
        packagePath,
        token,
        options,
        currentDir,
        deployHandler,
    });
    const { configMutations, exitCode, newConfig } = await runBuild(resolvedOptions);
    if (exitCode !== 0) {
        exit(exitCode);
    }
    return { newConfig, configMutations };
};
const bundleEdgeFunctions = async (options, command) => {
    const argv = process.argv.slice(2);
    const statusCb = options.silent || argv.includes('--json') || argv.includes('--silent') ? () => { } : deployProgressCb();
    statusCb({
        type: 'edge-functions-bundling',
        msg: 'Bundling edge functions...\n',
        phase: 'start',
    });
    const { severityCode, success } = await runCoreSteps(['edge_functions_bundling'], {
        ...options,
        packagePath: command.workspacePackage,
        buffer: true,
        featureFlags: edgeFunctionsFeatureFlags,
        // We log our own progress so we don't want this as well. Plus, this logs much of the same
        // information as the build that (likely) came before this as part of the deploy build.
        quiet: options.debug ?? true,
        // @ts-expect-error FIXME(serhalp): This is missing from the `runCoreSteps` type in @netlify/build
        edgeFunctionsBootstrapURL: await getBootstrapURL(),
    });
    if (!success) {
        statusCb({
            type: 'edge-functions-bundling',
            msg: 'Deploy aborted due to error while bundling edge functions',
            phase: 'error',
        });
        exit(severityCode);
    }
    statusCb({
        type: 'edge-functions-bundling',
        msg: 'Finished bundling edge functions',
        phase: 'stop',
    });
};
const printResults = ({ deployToProduction, json, results, runBuildCommand, }) => {
    const msgData = {
        'Build logs': terminalLink(results.logsUrl, results.logsUrl, { fallback: false }),
        'Function logs': terminalLink(results.functionLogsUrl, results.functionLogsUrl, { fallback: false }),
        'Edge function Logs': terminalLink(results.edgeFunctionLogsUrl, results.edgeFunctionLogsUrl, { fallback: false }),
    };
    log('');
    // Note: this is leakily mimicking the @netlify/build heading style
    log(chalk.cyanBright.bold(`🚀 Deploy complete\n${'─'.repeat(64)}`));
    // Json response for piping commands
    if (json) {
        const jsonData = {
            site_id: results.siteId,
            site_name: results.siteName,
            deploy_id: results.deployId,
            deploy_url: results.deployUrl,
            logs: results.logsUrl,
            function_logs: results.functionLogsUrl,
            edge_function_logs: results.edgeFunctionLogsUrl,
        };
        if (deployToProduction) {
            jsonData.url = results.siteUrl;
        }
        logJson(jsonData);
        exit(0);
    }
    else {
        const message = deployToProduction
            ? `Deployed to production URL: ${terminalLink(results.siteUrl, results.siteUrl, { fallback: false })}\n
    Unique deploy URL: ${terminalLink(results.deployUrl, results.deployUrl, { fallback: false })}`
            : `Deployed draft to ${terminalLink(results.deployUrl, results.deployUrl, { fallback: false })}`;
        log(boxen(message, {
            padding: 1,
            margin: 1,
            textAlignment: 'center',
            borderStyle: 'round',
            borderColor: NETLIFY_CYAN_HEX,
            // This is an intentional half-width space to work around a unicode padding math bug in boxen
            // eslint-disable-next-line no-irregular-whitespace
            title: `⬥  ${deployToProduction ? 'Production deploy' : 'Draft deploy'} is live ⬥ `,
            titleAlignment: 'center',
        }));
        log(prettyjson.render(msgData));
        if (!deployToProduction) {
            log();
            log('If everything looks good on your draft URL, deploy it to your main project URL with the --prod flag:');
            log(chalk.cyanBright.bold(`netlify deploy${runBuildCommand ? '' : ' --no-build'} --prod`));
            log();
        }
    }
};
const prepAndRunDeploy = async ({ api, command, config, deployToProduction, options, site, siteData, siteId, workingDir, }) => {
    const alias = options.alias || options.branch;
    // if a context is passed besides dev, we need to pull env vars from that specific context
    if (options.context && options.context !== 'dev') {
        command.netlify.cachedConfig.env = await getEnvelopeEnv({
            api,
            context: options.context,
            env: command.netlify.cachedConfig.env,
            siteInfo: siteData,
        });
    }
    const deployFolder = await getDeployFolder({ command, options, config, site, siteData });
    const functionsFolder = getFunctionsFolder({ workingDir, options, config, site, siteData });
    const { configPath } = site;
    const edgeFunctionsConfig = command.netlify.config.edge_functions;
    // build flag wasn't used and edge functions exist
    if (!options.build && edgeFunctionsConfig && edgeFunctionsConfig.length !== 0) {
        await bundleEdgeFunctions(options, command);
    }
    log('');
    // Note: this is leakily mimicking the @netlify/build heading style
    log(chalk.cyanBright.bold(`Deploying to Netlify\n${'─'.repeat(64)}`));
    log('');
    log(prettyjson.render({
        'Deploy path': deployFolder,
        'Functions path': functionsFolder,
        'Configuration path': configPath,
    }));
    log();
    const { functionsFolderStat } = await validateFolders({
        deployFolder,
        functionsFolder,
    });
    const siteEnv = await getEnvelopeEnv({
        api,
        context: options.context,
        env: command.netlify.cachedConfig.env,
        raw: true,
        scope: 'functions',
        siteInfo: siteData,
    });
    const functionsConfig = normalizeFunctionsConfig({
        functionsConfig: config.functions,
        projectRoot: site.root,
        siteEnv,
    });
    const results = await runDeploy({
        // @ts-expect-error FIXME
        alias,
        api,
        command,
        config,
        deployFolder,
        deployTimeout: options.timeout ? options.timeout * SEC_TO_MILLISEC : DEFAULT_DEPLOY_TIMEOUT,
        deployToProduction,
        functionsConfig,
        // pass undefined functionsFolder if doesn't exist
        functionsFolder: functionsFolderStat && functionsFolder,
        options,
        packagePath: command.workspacePackage,
        silent: options.json || options.silent,
        site,
        siteData,
        siteId,
        skipFunctionsCache: options.skipFunctionsCache,
        title: options.message,
    });
    return results;
};
export const deploy = async (options, command) => {
    const { workingDir } = command;
    const { api, site, siteInfo } = command.netlify;
    const alias = options.alias || options.branch;
    command.setAnalyticsPayload({ open: options.open, prod: options.prod, json: options.json, alias: Boolean(alias) });
    await command.authenticate(options.auth);
    let initialSiteData;
    let newSiteData;
    const hasSiteData = (site.id || options.site) && !isEmpty(siteInfo);
    if (hasSiteData) {
        initialSiteData = siteInfo;
    }
    else {
        log("This folder isn't linked to a project yet");
        const NEW_SITE = '+  Create & configure a new project';
        const EXISTING_SITE = 'Link this directory to an existing project';
        const initializeOpts = [EXISTING_SITE, NEW_SITE];
        const { initChoice } = await inquirer.prompt([
            {
                type: 'list',
                name: 'initChoice',
                message: 'What would you like to do?',
                choices: initializeOpts,
            },
        ]);
        // create site or search for one
        switch (initChoice) {
            case NEW_SITE:
                newSiteData = await sitesCreate({}, command);
                site.id = newSiteData.id;
                break;
            case EXISTING_SITE:
                newSiteData = await link({}, command);
                site.id = newSiteData.id;
                break;
        }
    }
    // This is the best I could come up with to make TS happy with the complexities above.
    const siteData = initialSiteData ?? newSiteData;
    const siteId = siteData.id;
    if (options.trigger) {
        return triggerDeploy({ api, options, siteData, siteId });
    }
    const deployToProduction = options.prod || (options.prodIfUnlocked && !(siteData.published_deploy?.locked ?? false));
    let results = {};
    if (options.build) {
        const settings = await detectFrameworkSettings(command, 'build');
        await handleBuild({
            packagePath: command.workspacePackage,
            cachedConfig: command.netlify.cachedConfig,
            defaultConfig: getDefaultConfig(settings),
            currentDir: command.workingDir,
            options,
            deployHandler: async ({ netlifyConfig }) => {
                results = await prepAndRunDeploy({
                    command,
                    options,
                    workingDir,
                    api,
                    site,
                    config: netlifyConfig,
                    siteData,
                    siteId,
                    deployToProduction,
                });
                return { newEnvChanges: { DEPLOY_ID: results.deployId, DEPLOY_URL: results.deployUrl } };
            },
        });
    }
    else {
        results = await prepAndRunDeploy({
            command,
            options,
            workingDir,
            api,
            site,
            config: command.netlify.config,
            siteData,
            siteId,
            deployToProduction,
        });
    }
    printResults({
        runBuildCommand: options.build,
        json: options.json,
        results,
        deployToProduction,
    });
    if (options.open) {
        const urlToOpen = deployToProduction ? results.siteUrl : results.deployUrl;
        await openBrowser({ url: urlToOpen });
        exit();
    }
};
//# sourceMappingURL=deploy.js.map