const fs = require('fs')
const path = require('path')

const { GraphQL, NetlifyGraph } = require('netlify-onegraph-internal')

const { detectServerSettings, error, getFunctionsDir } = require('../../utils')

const { printSchema } = GraphQL

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
    error(detectServerSettingsError.message)
  }

  const framework = settings.framework || userSpecifiedConfig.framework
  const isNextjs = framework === 'Next.js'
  const detectedFunctionsPathString = getFunctionsDir({ config, options })
  const detectedFunctionsPath = detectedFunctionsPathString ? detectedFunctionsPathString.split(path.sep) : null
  const functionsPath = isNextjs ? ['pages', 'api'] : detectedFunctionsPath || [`functions`]
  const baseConfig = { ...NetlifyGraph.defaultNetlifyGraphConfig, ...userSpecifiedConfig }
  const netlifyGraphImplementationFilename = [...baseConfig.netlifyGraphPath, `index.${baseConfig.extension}`]
  const netlifyGraphTypeDefinitionsFilename = [...baseConfig.netlifyGraphPath, `index.d.ts`]
  const graphQLOperationsSourceFilename = [...baseConfig.netlifyGraphPath, NetlifyGraph.defaultSourceOperationsFilename]
  const netlifyGraphRequirePath = isNextjs ? ['..', '..', 'lib', 'netlifyGraph'] : [`./netlifyGraph`]
  const fullConfig = {
    ...baseConfig,
    functionsPath,
    netlifyGraphImplementationFilename,
    netlifyGraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    netlifyGraphRequirePath,
    framework,
  }

  return fullConfig
}

/**
 * Given a NetlifyGraphConfig, ensure that the netlifyGraphPath exists
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureNetlifyGraphPath = (netlifyGraphConfig) => {
  fs.mkdirSync(path.join(...netlifyGraphConfig.netlifyGraphPath), { recursive: true })
}

/**
 * Given a NetlifyGraphConfig, ensure that the functionsPath exists
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureFunctionsPath = (netlifyGraphConfig) => {
  fs.mkdirSync(path.join(...netlifyGraphConfig.functionsPath), { recursive: true })
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
  fs.writeFileSync(path.join(...netlifyGraphConfig.netlifyGraphImplementationFilename), clientSource, 'utf8')
  fs.writeFileSync(path.join(...netlifyGraphConfig.netlifyGraphTypeDefinitionsFilename), typeDefinitionsSource, 'utf8')
}

/**
 * Using the given NetlifyGraphConfig, read the GraphQL operations file and return the _unparsed_ GraphQL operations doc
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string} GraphQL operations doc
 */
const readGraphQLOperationsSourceFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)

  const fullFilename = path.join(...netlifyGraphConfig.graphQLOperationsSourceFilename)
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
  fs.writeFileSync(path.join(...netlifyGraphConfig.graphQLOperationsSourceFilename), graphqlSource, 'utf8')
}

/**
 * Write a GraphQL Schema printed in SDL format to the filesystem using the given NetlifyGraphConfig
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @param {GraphQLSchema} schema The GraphQL schema to print and write to the filesystem
 */
const writeGraphQLSchemaFile = (netlifyGraphConfig, schema) => {
  const graphqlSource = printSchema(schema)

  ensureNetlifyGraphPath(netlifyGraphConfig)
  fs.writeFileSync(path.join(...netlifyGraphConfig.graphQLSchemaFilename), graphqlSource, 'utf8')
}

/**
 * Using the given NetlifyGraphConfig, read the GraphQL schema file and return it _unparsed_
 * @param {NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string} GraphQL schema
 */
const readGraphQLSchemaFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)
  return fs.readFileSync(path.join(...netlifyGraphConfig.graphQLSchemaFilename), 'utf8')
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

  const handlerSource = NetlifyGraph.generateHandlerSource({
    handlerOptions,
    schema,
    netlifyGraphConfig,
    operationId,
    operationsDoc: currentOperationsDoc,
  })

  if (!(handlerSource && handlerSource.source)) {
    return
  }

  const { operation, source } = handlerSource

  const filenameArr = [...netlifyGraphConfig.functionsPath, `${operation.name}.${netlifyGraphConfig.extension}`]
  const fullFilename = path.join(...filenameArr)

  ensureFunctionsPath(netlifyGraphConfig)
  fs.writeFileSync(fullFilename, source)
}

// Export the minimal set of functions that are required for Netlify Graph
const { buildSchema, parse } = GraphQL

module.exports = {
  buildSchema,
  defaultExampleOperationsDoc: NetlifyGraph.defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc: NetlifyGraph.extractFunctionsFromOperationDoc,
  generateFunctionsSource: NetlifyGraph.generateFunctionsSource,
  generateFunctionsFile,
  generateHandlerSource: NetlifyGraph.generateHandlerSource,
  generateHandler,
  getNetlifyGraphConfig,
  parse,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
}
