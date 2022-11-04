const cleanDeep = require('clean-deep')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'tempy'.
const tempy = require('tempy')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'edgeFuncti... Remove this comment to see the full error message
const edgeFunctions = require('../../lib/edge-functions/index.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'rmdirRecur... Remove this comment to see the full error message
const { rmdirRecursiveAsync } = require('../../lib/fs.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'warn'.
const { warn } = require('../command-helpers.cjs')

const {
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_CO... Remove this comment to see the full error message
  DEFAULT_CONCURRENT_HASH,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_CO... Remove this comment to see the full error message
  DEFAULT_CONCURRENT_UPLOAD,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_DE... Remove this comment to see the full error message
  DEFAULT_DEPLOY_TIMEOUT,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_MA... Remove this comment to see the full error message
  DEFAULT_MAX_RETRY,
  // @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DEFAULT_SY... Remove this comment to see the full error message
  DEFAULT_SYNC_LIMIT,
} = require('./constants.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'hashFiles'... Remove this comment to see the full error message
const { hashFiles } = require('./hash-files.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'hashFns'.
const { hashFns } = require('./hash-fns.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'uploadFile... Remove this comment to see the full error message
const { uploadFiles } = require('./upload-files.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getUploadL... Remove this comment to see the full error message
const { getUploadList, waitForDeploy, waitForDiff } = require('./util.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'deploySite... Remove this comment to see the full error message
const deploySite = async (
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  api: $TSFixMe,
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  siteId: $TSFixMe,
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  dir: $TSFixMe,
  {
    assetType,
    branch,
    concurrentHash = DEFAULT_CONCURRENT_HASH,
    concurrentUpload = DEFAULT_CONCURRENT_UPLOAD,
    configPath = null,
    deployId: deployIdOpt = null,
    deployTimeout = DEFAULT_DEPLOY_TIMEOUT,
    draft = false,
    filter,
    fnDir = [],
    functionsConfig,
    hashAlgorithm,
    manifestPath,
    maxRetry = DEFAULT_MAX_RETRY,

    // API calls this the 'title'
    message: title,

    siteEnv,
    skipFunctionsCache,

    statusCb = () => {
      /* default to noop */
    },

    syncFileLimit = DEFAULT_SYNC_LIMIT,
    tmpDir = tempy.directory(),
    rootDir
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  }: $TSFixMe = {},
) => {
  statusCb({
    type: 'hashing',
    msg: `Hashing files...`,
    phase: 'start',
  })

  const edgeFunctionsDistPath = await edgeFunctions.getDistPathIfExists({ rootDir })
  const [{ files, filesShaMap }, { fnShaMap, functionSchedules, functions, functionsWithNativeModules }] =
    await Promise.all([
      hashFiles({
        assetType,
        concurrentHash,
        directories: [configPath, dir, edgeFunctionsDistPath].filter(Boolean),
        filter,
        hashAlgorithm,
        normalizer: edgeFunctions.deployFileNormalizer.bind(null, rootDir),
        statusCb,
      }),
      hashFns(fnDir, {
        functionsConfig,
        tmpDir,
        concurrentHash,
        hashAlgorithm,
        statusCb,
        assetType,
        rootDir,
        manifestPath,
        skipFunctionsCache,
        siteEnv,
      }),
    ])
  const edgeFunctionsCount = Object.keys(files).filter(edgeFunctions.isEdgeFunctionFile).length
  const filesCount = Object.keys(files).length - edgeFunctionsCount
  const functionsCount = Object.keys(functions).length
  const stats = buildStatsString([
    filesCount > 0 && `${filesCount} files`,
    functionsCount > 0 && `${functionsCount} functions`,
    edgeFunctionsCount > 0 && 'edge functions',
  ])

  statusCb({
    type: 'hashing',
    msg: `Finished hashing ${stats}`,
    phase: 'stop',
  })

  if (filesCount === 0 && functionsCount === 0) {
    throw new Error('No files or functions to deploy')
  }

  if (functionsWithNativeModules.length !== 0) {
    warn(`Modules with native dependencies\n
${functionsWithNativeModules.map(({
      name
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    }: $TSFixMe) => `- ${name}`).join('\n')}

The serverless functions above use Node.js modules with native dependencies, which
must be installed on a system with the same architecture as the function runtime. A
mismatch in the system and runtime may lead to errors when invoking your functions.
To ensure your functions work as expected, we recommend using continuous deployment
instead of manual deployment.

For more information, visit https://ntl.fyi/cli-native-modules.`)
  }

  statusCb({
    type: 'create-deploy',
    msg: 'CDN diffing files...',
    phase: 'start',
  })

  let deploy
  let deployParams = cleanDeep({
    siteId,
    body: {
      files,
      functions,
      function_schedules: functionSchedules,
      async: Object.keys(files).length > syncFileLimit,
      branch,
      draft,
    },
  })
  if (deployIdOpt === null) {
    if (title) {
      deployParams = { ...deployParams, title }
    }
    deploy = await api.createSiteDeploy(deployParams)
  } else {
    deployParams = { ...deployParams, deploy_id: deployIdOpt }
    deploy = await api.updateSiteDeploy(deployParams)
  }

  if (deployParams.body.async) deploy = await waitForDiff(api, deploy.id, siteId, deployTimeout)

  const { id: deployId, required: requiredFiles, required_functions: requiredFns } = deploy

  statusCb({
    type: 'create-deploy',
    msg: `CDN requesting ${requiredFiles.length} files${
      Array.isArray(requiredFns) ? ` and ${requiredFns.length} functions` : ''
    }`,
    phase: 'stop',
  })

  const filesUploadList = getUploadList(requiredFiles, filesShaMap)
  const functionsUploadList = getUploadList(requiredFns, fnShaMap)
  const uploadList = [...filesUploadList, ...functionsUploadList]

  await uploadFiles(api, deployId, uploadList, { concurrentUpload, statusCb, maxRetry })

  statusCb({
    type: 'wait-for-deploy',
    msg: 'Waiting for deploy to go live...',
    phase: 'start',
  })
  deploy = await waitForDeploy(api, deployId, siteId, deployTimeout)

  statusCb({
    type: 'wait-for-deploy',
    msg: draft ? 'Draft deploy is live!' : 'Deploy is live!',
    phase: 'stop',
  })

  await rmdirRecursiveAsync(tmpDir)

  const deployManifest = {
    deployId,
    deploy,
    uploadList,
  }
  return deployManifest
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const buildStatsString = (possibleParts: $TSFixMe) => {
  const parts = possibleParts.filter(Boolean)
  const message = parts.slice(0, -1).join(', ')

  return parts.length > 1 ? `${message} and ${parts[parts.length - 1]}` : message
}

module.exports = { deploySite }
