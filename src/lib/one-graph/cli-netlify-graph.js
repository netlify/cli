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
 * Return a full NetlifyGraph config with any defaults overridden by netlify.toml
 * @param {import('../base-command').BaseCommand} command
 * @return {NetlifyGraphConfig} NetlifyGraphConfig
 */
const getNetlifyGraphConfig = async ({ command, options }) => {
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
  let settings = {}
  try {
    settings = await detectServerSettings(devConfig, options, site.root)
  } catch (detectServerSettingsError) {
    error(detectServerSettingsError)
  }

  const siteRoot = [path.sep, ...filterRelativePathItems(site.root.split(path.sep))]

  const tsConfig = 'tsconfig.json'
  const autodetectedLanguage = fs.existsSync(tsConfig) ? 'typescript' : 'javascript'

  const framework = settings.framework || userSpecifiedConfig.framework
  const isNextjs = framework === 'Next.js'
  const detectedFunctionsPathString = getFunctionsDir({ config, options })
  const detectedFunctionsPath = detectedFunctionsPathString ? detectedFunctionsPathString.split(path.sep) : null
  const functionsPath = filterRelativePathItems(isNextjs ? [...siteRoot, 'pages', 'api'] : [...detectedFunctionsPath])
  const netlifyGraphPath = filterRelativePathItems(
    isNextjs
      ? [...siteRoot, 'lib', 'netlifyGraph']
      : [...siteRoot, ...NetlifyGraph.defaultNetlifyGraphConfig.netlifyGraphPath],
  )
  const baseConfig = { ...NetlifyGraph.defaultNetlifyGraphConfig, ...userSpecifiedConfig }
  const netlifyGraphImplementationFilename = [...netlifyGraphPath, `index.${baseConfig.extension}`]
  const netlifyGraphTypeDefinitionsFilename = [...netlifyGraphPath, `index.d.ts`]
  const graphQLOperationsSourceFilename = [...netlifyGraphPath, NetlifyGraph.defaultSourceOperationsFilename]
  const graphQLSchemaFilename = [...netlifyGraphPath, NetlifyGraph.defaultGraphQLSchemaFilename]
  const netlifyGraphRequirePath = isNextjs ? ['..', '..', 'lib', 'netlifyGraph'] : [`./netlifyGraph`]
  const language = userSpecifiedConfig.language || autodetectedLanguage
  const moduleType = baseConfig.moduleType || isNextjs ? 'esm' : 'commonjs'
  const fullConfig = {
    ...baseConfig,
    functionsPath,
    netlifyGraphPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netlifyGraphRequirePath,
    framework,
    language,
    moduleType,
  }

  return fullConfig
}

/**
 * Given a NetlifyGraphConfig, ensure that the netlifyGraphPath exists
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureNetlifyGraphPath = (netlifyGraphConfig) => {
  fs.mkdirSync(path.resolve(...netlifyGraphConfig.netlifyGraphPath), { recursive: true })
}

/**
 * Given a NetlifyGraphConfig, ensure that the functionsPath exists
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureFunctionsPath = (netlifyGraphConfig) => {
  fs.mkdirSync(path.resolve(...netlifyGraphConfig.functionsPath), { recursive: true })
}

/**
 * Generate a library file with type definitions for a given NetlifyGraphConfig, operationsDoc, and schema, writing them to the filesystem
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @param {GraphQLSchema} schema The schema to use when generating the functions and their types
 * @param {string} operationsDoc The GraphQL operations doc to use when generating the functions
 * @param {NetlifyGraph.ParsedFunction} queries The parsed queries with metadata to use when generating library functions
 */
const generateFunctionsFile = (netlifyGraphConfig, schema, operationsDoc, queries) => {
  const { clientSource, typeDefinitionsSource } = NetlifyGraph.generateFunctionsSource(
    netlifyGraphConfig,
    schema,
    operationsDoc,
    queries,
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

  const result = NetlifyGraph.generateHandlerSource({
    handlerOptions,
    schema,
    netlifyGraphConfig,
    operationId,
    operationsDoc: currentOperationsDoc,
  })

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
  const host = 'app.netlify.com' || process.env.NETLIFY_APP_HOST
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
