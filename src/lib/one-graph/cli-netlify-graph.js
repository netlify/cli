const fs = require('fs')
const path = require('path')
const process = require('process')

const { GraphQL, InternalConsole, NetlifyGraph } = require('netlify-onegraph-internal')

const { detectServerSettings, error, getFunctionsDir, log, warn } = require('../../utils')

const { printSchema } = GraphQL

const internalConsole = {
  log,
  warn,
  error,
  debug: console.debug,
}

InternalConsole.registerConsole(internalConsole)

/**
 * Remove any relative path components from the given path
 * @param {string[]} items Filesystem path items to filter
 * @return {string[]} Filtered filesystem path items
 */
const filterRelativePathItems = (items) => items.filter((part) => part !== '')

/**
 * Return the default Netlify Graph configuration for a generic site
 * @param {object} context
 * @param {string[]} context.detectedFunctionsPath
 * @param {string[]} context.siteRoot
 */
const makeDefaultNetlifGraphConfig = ({ baseConfig, detectedFunctionsPath }) => {
  const functionsPath = filterRelativePathItems([...detectedFunctionsPath])
  const webhookBasePath = '/.netlify/functions'
  const netlifyGraphPath = [...functionsPath, 'netlifyGraph']
  const netlifyGraphImplementationFilename = [...netlifyGraphPath, `index.${baseConfig.extension}`]
  const netlifyGraphTypeDefinitionsFilename = [...netlifyGraphPath, `index.d.ts`]
  const graphQLOperationsSourceFilename = [...netlifyGraphPath, NetlifyGraph.defaultSourceOperationsFilename]
  const graphQLSchemaFilename = [...netlifyGraphPath, NetlifyGraph.defaultGraphQLSchemaFilename]
  const netlifyGraphRequirePath = [`./netlifyGraph`]
  const moduleType = baseConfig.moduleType || 'esm'

  return {
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    moduleType,
  }
}

/**
 * Return the default Netlify Graph configuration for a Nextjs site
 * @param {object} context
 * @param {string[]} context.detectedFunctionsPath
 * @param {string[]} context.siteRoot
 */
const makeDefaultNextJsNetlifGraphConfig = ({ baseConfig, siteRoot }) => {
  const functionsPath = filterRelativePathItems([...siteRoot, 'pages', 'api'])
  const webhookBasePath = '/api'
  const netlifyGraphPath = filterRelativePathItems([...siteRoot, 'lib', 'netlifyGraph'])
  const netlifyGraphImplementationFilename = [...netlifyGraphPath, `index.${baseConfig.extension}`]
  const netlifyGraphTypeDefinitionsFilename = [...netlifyGraphPath, `index.d.ts`]
  const graphQLOperationsSourceFilename = [...netlifyGraphPath, NetlifyGraph.defaultSourceOperationsFilename]
  const graphQLSchemaFilename = [...netlifyGraphPath, NetlifyGraph.defaultGraphQLSchemaFilename]
  const netlifyGraphRequirePath = ['..', '..', 'lib', 'netlifyGraph']
  const moduleType = baseConfig.moduleType || 'esm'

  return {
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    moduleType,
  }
}

/**
 * Return the default Netlify Graph configuration for a Remix site
 * @param {object} context
 * @param {string[]} context.detectedFunctionsPath
 * @param {string[]} context.siteRoot
 */
const makeDefaultRemixNetlifGraphConfig = ({ baseConfig, detectedFunctionsPath, siteRoot }) => {
  const functionsPath = filterRelativePathItems([...detectedFunctionsPath])
  const webhookBasePath = '/webhooks'
  const netlifyGraphPath = filterRelativePathItems([
    ...siteRoot,
    ...NetlifyGraph.defaultNetlifyGraphConfig.netlifyGraphPath,
  ])
  const netlifyGraphImplementationFilename = [...netlifyGraphPath, `index.${baseConfig.extension}`]
  const netlifyGraphTypeDefinitionsFilename = [...netlifyGraphPath, `index.d.ts`]
  const graphQLOperationsSourceFilename = [...netlifyGraphPath, NetlifyGraph.defaultSourceOperationsFilename]
  const graphQLSchemaFilename = [...netlifyGraphPath, NetlifyGraph.defaultGraphQLSchemaFilename]
  const netlifyGraphRequirePath = [`../../netlify/functions/netlifyGraph`]
  const moduleType = 'esm'

  return {
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    moduleType,
  }
}

const defaultFrameworkLookup = {
  'Next.js': makeDefaultNextJsNetlifGraphConfig,
  Remix: makeDefaultRemixNetlifGraphConfig,
  default: makeDefaultNetlifGraphConfig,
}

/**
 * Return a full NetlifyGraph config with any defaults overridden by netlify.toml
 * @param {import('../base-command').BaseCommand} command
 * @return {NetlifyGraphConfig} NetlifyGraphConfig
 */
const getNetlifyGraphConfig = async ({ command, options, settings }) => {
  const { config, site } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  const userSpecifiedConfig = (config && config.graph) || {}
  /** @type {import('./types').DevConfig} */
  const devConfig = {
    framework: '#auto',
    ...(config.functionsDirectory && { functions: config.functionsDirectory }),
    ...(config.build.publish && { publish: config.build.publish }),
    ...config.dev,
    ...options,
  }

  /** @type {Partial<import('../../utils/types').ServerSettings>} */
  if (!settings) {
    try {
      settings = await detectServerSettings(devConfig, options, site.root)
    } catch (detectServerSettingsError) {
      settings = {}
      warn('Error while auto-detecting project settings, Netlify Graph encounter problems', detectServerSettingsError)
    }
  }

  const siteRoot = [path.sep, ...filterRelativePathItems(site.root.split(path.sep))]

  const tsConfig = 'tsconfig.json'
  const autodetectedLanguage = fs.existsSync(tsConfig) ? 'typescript' : 'javascript'

  const framework = settings.framework || userSpecifiedConfig.framework
  const makeDefaultFrameworkConfig = defaultFrameworkLookup[framework] || defaultFrameworkLookup.default

  const detectedFunctionsPathString = getFunctionsDir({ config, options })
  const detectedFunctionsPath = detectedFunctionsPathString
    ? [path.sep, ...detectedFunctionsPathString.split(path.sep)]
    : null
  const baseConfig = { ...NetlifyGraph.defaultNetlifyGraphConfig, ...userSpecifiedConfig }
  const defaultFrameworkConfig = makeDefaultFrameworkConfig({ baseConfig, detectedFunctionsPath, siteRoot })

  const functionsPath =
    (userSpecifiedConfig.functionsPath && userSpecifiedConfig.functionsPath.split(path.sep)) ||
    defaultFrameworkConfig.functionsPath
  const netlifyGraphPath =
    (userSpecifiedConfig.netlifyGraphPath && userSpecifiedConfig.netlifyGraphPath.split(path.sep)) ||
    defaultFrameworkConfig.netlifyGraphPath
  const netlifyGraphImplementationFilename =
    (userSpecifiedConfig.netlifyGraphImplementationFilename &&
      userSpecifiedConfig.netlifyGraphImplementationFilename.split(path.sep)) ||
    defaultFrameworkConfig.netlifyGraphImplementationFilename
  const netlifyGraphTypeDefinitionsFilename =
    (userSpecifiedConfig.netlifyGraphTypeDefinitionsFilename &&
      userSpecifiedConfig.netlifyGraphTypeDefinitionsFilename.split(path.sep)) ||
    defaultFrameworkConfig.netlifyGraphTypeDefinitionsFilename
  const graphQLOperationsSourceFilename =
    (userSpecifiedConfig.graphQLOperationsSourceFilename &&
      userSpecifiedConfig.graphQLOperationsSourceFilename.split(path.sep)) ||
    defaultFrameworkConfig.graphQLOperationsSourceFilename
  const graphQLSchemaFilename =
    (userSpecifiedConfig.graphQLSchemaFilename && userSpecifiedConfig.graphQLSchemaFilename.split(path.sep)) ||
    defaultFrameworkConfig.graphQLSchemaFilename
  const netlifyGraphRequirePath =
    (userSpecifiedConfig.netlifyGraphRequirePath && userSpecifiedConfig.netlifyGraphRequirePath.split(path.sep)) ||
    defaultFrameworkConfig.netlifyGraphRequirePath
  const moduleType =
    (userSpecifiedConfig.moduleType && userSpecifiedConfig.moduleType.split(path.sep)) ||
    defaultFrameworkConfig.moduleType
  const language =
    (userSpecifiedConfig.language && userSpecifiedConfig.language.split(path.sep)) || autodetectedLanguage
  const webhookBasePath =
    (userSpecifiedConfig.webhookBasePath && userSpecifiedConfig.webhookBasePath.split(path.sep)) ||
    defaultFrameworkConfig.webhookBasePath
  const customGeneratorFile =
    userSpecifiedConfig.customGeneratorFile && userSpecifiedConfig.customGeneratorFile.split(path.sep)
  const runtimeTargetEnv = userSpecifiedConfig.runtimeTargetEnv || defaultFrameworkConfig.runtimeTargetEnv || 'node'

  const fullConfig = {
    ...baseConfig,
    functionsPath,
    webhookBasePath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    framework,
    language,
    moduleType,
    customGeneratorFile,
    runtimeTargetEnv,
  }

  return fullConfig
}

/**
 * Given a NetlifyGraphConfig, ensure that the netlifyGraphPath exists
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureNetlifyGraphPath = (netlifyGraphConfig) => {
  const fullPath = path.resolve(...netlifyGraphConfig.netlifyGraphPath)
  fs.mkdirSync(fullPath, { recursive: true })
}

/**
 * Given a NetlifyGraphConfig, ensure that the functionsPath exists
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureFunctionsPath = (netlifyGraphConfig) => {
  const fullPath = path.resolve(...netlifyGraphConfig.functionsPath)
  fs.mkdirSync(fullPath, { recursive: true })
}

/**
 * Generate a library file with type definitions for a given NetlifyGraphConfig, operationsDoc, and schema, writing them to the filesystem
 * @param {object} context
 * @param {NetlifyGraphConfig} context.netlifyGraphConfig
 * @param {GraphQLSchema} context.schema The schema to use when generating the functions and their types
 * @param {string} context.operationsDoc The GraphQL operations doc to use when generating the functions
 * @param {NetlifyGraph.ParsedFunction} context.functions The parsed queries with metadata to use when generating library functions
 * @param {NetlifyGraph.ParsedFragment} context.fragments The parsed queries with metadata to use when generating library functions
 * @returns {void} Void, effectfully writes the generated library to the filesystem
 */
const generateFunctionsFile = ({ fragments, functions, netlifyGraphConfig, operationsDoc, schema }) => {
  const { clientSource, typeDefinitionsSource } = NetlifyGraph.generateFunctionsSource(
    netlifyGraphConfig,
    schema,
    operationsDoc,
    functions,
    fragments,
  )

  ensureNetlifyGraphPath(netlifyGraphConfig)
  fs.writeFileSync(path.resolve(...netlifyGraphConfig.netlifyGraphImplementationFilename), clientSource, 'utf8')
  fs.writeFileSync(
    path.resolve(...netlifyGraphConfig.netlifyGraphTypeDefinitionsFilename),
    typeDefinitionsSource,
    'utf8',
  )
}

/**
 * Using the given NetlifyGraphConfig, read the GraphQL operations file and return the _unparsed_ GraphQL operations doc
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string} GraphQL operations doc
 */
const readGraphQLOperationsSourceFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)

  const fullFilename = path.resolve(...netlifyGraphConfig.graphQLOperationsSourceFilename)
  if (!fs.existsSync(fullFilename)) {
    fs.writeFileSync(fullFilename, '')
    fs.closeSync(fs.openSync(fullFilename, 'w'))
  }

  const source = fs.readFileSync(fullFilename, 'utf8')

  return source
}

/**
 * Write an operations doc to the filesystem using the given NetlifyGraphConfig
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @param {string} operationsDoc The GraphQL operations doc to write
 */
const writeGraphQLOperationsSourceFile = (netlifyGraphConfig, operationDocString) => {
  const graphqlSource = operationDocString

  ensureNetlifyGraphPath(netlifyGraphConfig)
  fs.writeFileSync(path.resolve(...netlifyGraphConfig.graphQLOperationsSourceFilename), graphqlSource, 'utf8')
}

/**
 * Write a GraphQL Schema printed in SDL format to the filesystem using the given NetlifyGraphConfig
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @param {GraphQLSchema} schema The GraphQL schema to print and write to the filesystem
 */
const writeGraphQLSchemaFile = (netlifyGraphConfig, schema) => {
  const graphqlSource = printSchema(schema)

  ensureNetlifyGraphPath(netlifyGraphConfig)
  fs.writeFileSync(path.resolve(...netlifyGraphConfig.graphQLSchemaFilename), graphqlSource, 'utf8')
}

/**
 * Using the given NetlifyGraphConfig, read the GraphQL schema file and return it _unparsed_
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string} GraphQL schema
 */
const readGraphQLSchemaFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)
  return fs.readFileSync(path.resolve(...netlifyGraphConfig.graphQLSchemaFilename), 'utf8')
}

/**
 * Given a NetlifyGraphConfig, read the appropriate files and write a handler for the given operationId to the filesystem
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @param {GraphQLSchema} schema The GraphQL schema to use when generating the handler
 * @param {string} operationId The operationId to use when generating the handler
 * @param {object} handlerOptions The options to use when generating the handler
 * @returns
 */
const generateHandler = (netlifyGraphConfig, schema, operationId, handlerOptions) => {
  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = NetlifyGraph.defaultExampleOperationsDoc
  }

  const payload = {
    handlerOptions,
    schema,
    netlifyGraphConfig,
    operationId,
    operationsDoc: currentOperationsDoc,
  }

  const result = NetlifyGraph.generateHandlerSource(payload)

  if (!result) {
    warn(`No handler was generated for operationId ${operationId}`)
    return
  }

  const { exportedFiles, operation } = result

  ensureFunctionsPath(netlifyGraphConfig)

  if (!exportedFiles) {
    return
  }

  exportedFiles.forEach((exportedFile) => {
    const { content } = exportedFile
    const isNamed = exportedFile.kind === 'NamedExportedFile'

    let filenameArr

    if (isNamed) {
      filenameArr = [...exportedFile.name]
    } else {
      const operationName = (operation.name && operation.name.value) || 'Unnamed'
      const fileExtension = netlifyGraphConfig.language === 'typescript' ? 'ts' : netlifyGraphConfig.extension
      const defaultBaseFilename = `${operationName}.${fileExtension}`
      const baseFilename = defaultBaseFilename

      filenameArr = [path.sep, ...netlifyGraphConfig.functionsPath, baseFilename]
    }

    const parentDir = path.resolve(...filterRelativePathItems(filenameArr.slice(0, -1)))

    // Make sure the parent directory exists
    fs.mkdirSync(parentDir, { recursive: true })

    const absoluteFilename = path.resolve(...filenameArr)

    fs.writeFileSync(absoluteFilename, content)
  })
}

// Export the minimal set of functions that are required for Netlify Graph
const { buildSchema, parse } = GraphQL

/**
 *
 * @param {object} options
 * @param {string} options.siteName The name of the site as used in the Netlify UI url scheme
 * @param {string} options.oneGraphSessionId The oneGraph session id to use when generating the graph-edit link
 * @returns {string} The url to the Netlify Graph UI for the current session
 */
const getGraphEditUrlBySiteName = ({ oneGraphSessionId, siteName }) => {
  const host = process.env.NETLIFY_APP_HOST || 'app.netlify.com'
  // http because app.netlify.com will redirect to https, and localhost will still work for development
  const url = `http://${host}/sites/${siteName}/graph/explorer?cliSessionId=${oneGraphSessionId}`

  return url
}

module.exports = {
  buildSchema,
  defaultExampleOperationsDoc: NetlifyGraph.defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc: NetlifyGraph.extractFunctionsFromOperationDoc,
  generateFunctionsSource: NetlifyGraph.generateFunctionsSource,
  generateFunctionsFile,
  generateHandlerSource: NetlifyGraph.generateHandlerSource,
  generateHandler,
  getGraphEditUrlBySiteName,
  getNetlifyGraphConfig,
  parse,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
}
