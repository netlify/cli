import { rm } from 'fs/promises';
import cleanDeep from 'clean-deep';
import { deployFileNormalizer, getDistPathIfExists, isEdgeFunctionFile } from '../../lib/edge-functions/deploy.js';
import { warn } from '../command-helpers.js';
import { DEFAULT_CONCURRENT_HASH, DEFAULT_CONCURRENT_UPLOAD, DEFAULT_DEPLOY_TIMEOUT, DEFAULT_MAX_RETRY, DEFAULT_SYNC_LIMIT, } from './constants.js';
import { hashConfig } from './hash-config.js';
import hashFiles from './hash-files.js';
import hashFns from './hash-fns.js';
import uploadFiles from './upload-files.js';
import { getUploadList, waitForDeploy, waitForDiff } from './util.js';
import { temporaryDirectory } from '../temporary-file.js';
const buildStatsString = (possibleParts) => {
    const parts = possibleParts.filter(Boolean);
    const message = parts.slice(0, -1).join(', ');
    return parts.length > 1 ? `${message} and ${parts[parts.length - 1]}` : message;
};
export const deploySite = async (command, api, 
// @ts-expect-error TS(7006) FIXME: Parameter 'siteId' implicitly has an 'any' type.
siteId, 
// @ts-expect-error TS(7006) FIXME: Parameter 'dir' implicitly has an 'any' type.
dir, { 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
assetType, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
branch, concurrentHash = DEFAULT_CONCURRENT_HASH, concurrentUpload = DEFAULT_CONCURRENT_UPLOAD, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
config, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
deployId, deployTimeout = DEFAULT_DEPLOY_TIMEOUT, draft = false, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
filter, fnDir = [], 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
functionsConfig, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
hashAlgorithm, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
manifestPath, maxRetry = DEFAULT_MAX_RETRY, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
siteRoot, 
// @ts-expect-error TS(2525) FIXME: Initializer provides no value for this binding ele... Remove this comment to see the full error message
skipFunctionsCache, statusCb = () => {
    /* default to noop */
}, syncFileLimit = DEFAULT_SYNC_LIMIT, tmpDir = temporaryDirectory(), workingDir, }) => {
    statusCb({
        type: 'hashing',
        msg: `Hashing files...`,
        phase: 'start',
    });
    const edgeFunctionsDistPath = await getDistPathIfExists(workingDir);
    const [{ files: staticFiles, filesShaMap: staticShaMap }, { fnConfig, fnShaMap, functionSchedules, functions, functionsWithNativeModules }, configFile,] = await Promise.all([
        hashFiles({
            assetType,
            concurrentHash,
            directories: [dir, edgeFunctionsDistPath].filter(Boolean),
            filter,
            hashAlgorithm,
            normalizer: deployFileNormalizer.bind(null, workingDir),
            statusCb,
        }),
        hashFns(command, fnDir, {
            functionsConfig,
            tmpDir,
            concurrentHash,
            hashAlgorithm,
            statusCb,
            manifestPath,
            skipFunctionsCache,
            rootDir: siteRoot,
        }),
        hashConfig({ config }),
    ]);
    const files = { ...staticFiles, [configFile.normalizedPath]: configFile.hash };
    const filesShaMap = { ...staticShaMap, [configFile.hash]: [configFile] };
    const edgeFunctionsCount = Object.keys(files).filter(isEdgeFunctionFile).length;
    const filesCount = Object.keys(files).length - edgeFunctionsCount;
    const functionsCount = Object.keys(functions).length;
    const stats = buildStatsString([
        filesCount > 0 && `${filesCount} files`,
        functionsCount > 0 && `${functionsCount} functions`,
        edgeFunctionsCount > 0 && 'edge functions',
    ]);
    statusCb({
        type: 'hashing',
        msg: `Finished hashing ${stats}`,
        phase: 'stop',
    });
    if (filesCount === 0 && functionsCount === 0) {
        throw new Error('No files or functions to deploy');
    }
    if (functionsWithNativeModules.length !== 0) {
        const functionsWithNativeModulesMessage = functionsWithNativeModules
            .map(({ name }) => `- ${name}`)
            .join('\n');
        warn(`Modules with native dependencies\n
    ${functionsWithNativeModulesMessage}

The serverless functions above use Node.js modules with native dependencies, which
must be installed on a system with the same architecture as the function runtime. A
mismatch in the system and runtime may lead to errors when invoking your functions.
To ensure your functions work as expected, we recommend using continuous deployment
instead of manual deployment.

For more information, visit https://ntl.fyi/cli-native-modules.`);
    }
    statusCb({
        type: 'create-deploy',
        msg: 'CDN diffing files...',
        phase: 'start',
    });
    // @ts-expect-error TS(2349) This expression is not callable
    const deployParams = cleanDeep({
        siteId,
        deploy_id: deployId,
        body: {
            files,
            functions,
            function_schedules: functionSchedules,
            functions_config: fnConfig,
            async: Object.keys(files).length > syncFileLimit,
            branch,
            draft,
        },
    });
    let deploy = await api.updateSiteDeploy(deployParams);
    if (deployParams.body.async)
        deploy = await waitForDiff(api, deploy.id, siteId, deployTimeout);
    const { required: requiredFiles, required_functions: requiredFns } = deploy;
    statusCb({
        type: 'create-deploy',
        msg: `CDN requesting ${requiredFiles.length} files${Array.isArray(requiredFns) ? ` and ${requiredFns.length} functions` : ''}`,
        phase: 'stop',
    });
    const filesUploadList = getUploadList(requiredFiles, filesShaMap);
    const functionsUploadList = getUploadList(requiredFns, fnShaMap);
    const uploadList = [...filesUploadList, ...functionsUploadList];
    await uploadFiles(api, deployId, uploadList, { concurrentUpload, statusCb, maxRetry });
    statusCb({
        type: 'wait-for-deploy',
        msg: 'Waiting for deploy to go live...',
        phase: 'start',
    });
    deploy = await waitForDeploy(api, deployId, siteId, deployTimeout);
    statusCb({
        type: 'wait-for-deploy',
        msg: draft ? 'Draft deploy is live!' : 'Deploy is live!',
        phase: 'stop',
    });
    await rm(tmpDir, { force: true, recursive: true });
    const deployManifest = {
        deployId,
        deploy,
        uploadList,
    };
    return deployManifest;
};
//# sourceMappingURL=deploy-site.js.map