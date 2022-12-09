/* eslint-disable eslint-comments/disable-enable-pair */

// @ts-check
import fs from 'fs'
import path from 'path'
import process from 'process'
import { pathToFileURL } from 'url'

import inquirer from 'inquirer'
import inquirerAutocompletePrompt from 'inquirer-autocomplete-prompt'
import { GraphQL, GraphQLHelpers, IncludedCodegen, InternalConsole, NetlifyGraph } from 'netlify-onegraph-internal'

import { chalk, error, log, warn } from '../../utils/command-helpers.mjs'
import detectServerSettings from '../../utils/detect-server-settings.mjs'
import execa from '../../utils/execa.mjs'
import { getFunctionsDir } from '../../utils/functions/index.mjs'

const { printSchema } = GraphQL

const internalConsole = {
  log,
  warn,
  error,
  debug: console.debug,
}

InternalConsole.registerConsole(internalConsole)

const { defaultExampleOperationsDoc, extractFunctionsFromOperationDoc, generateHandlerSource } = NetlifyGraph
const { normalizeOperationsDoc } = GraphQLHelpers

/**
 * Updates the netlify.toml in-place with the `graph.codeGenerator` key set to `codegenModuleImportPath
 * It's a very hacky, string-based implementation for because
 * 1. There isn't a good toml parser/updater/pretty-printer that preserves formatting and comments
 * 2. We want to make minimal changes to `netlify.toml`
 * @param {object} input
 * @param {string} input.siteRoot
 * @param {string} input.codegenModuleImportPath
 * @returns void
 */
const setNetlifyTomlCodeGeneratorModule = ({ codegenModuleImportPath, siteRoot }) => {
  let toml
  let filepath

  try {
    const filepathArr = ['/', ...siteRoot.split(path.sep), 'netlify.toml']
    filepath = path.resolve(...filepathArr)
    const configText = fs.readFileSync(filepath, 'utf-8')

    toml = configText
  } catch (error_) {
    warn(`Error reading netlify.toml for Netlify Graph codegenModule update: ${error_}`)
  }

  if (!filepath) {
    return
  }

  const entry = `  codeGenerator = "${codegenModuleImportPath}"
`

  const fullEntry = `
[graph]
${entry}`

  if (!toml) {
    fs.writeFileSync(filepath, fullEntry, 'utf-8')
    return
  }

  const EOL = '\n'
  let lines = toml.split(EOL)
  const graphKeyLine = lines.findIndex((line) => line.trim().startsWith('[graph]'))
  const hasGraphKey = graphKeyLine !== -1
  const codegenKeyLine = lines.findIndex((line) => line.trim().startsWith('codeGenerator'))
  const hasCodegenKeyLine = codegenKeyLine !== 1

  if (hasGraphKey && hasCodegenKeyLine) {
    lines.splice(codegenKeyLine, 1, entry)
  } else if (hasGraphKey) {
    lines.splice(graphKeyLine, 0, entry)
  } else {
    lines = [...lines, ...fullEntry.split(EOL)]
  }

  const newToml = lines.join(EOL)

  fs.writeFileSync(filepath, newToml, 'utf-8')
}

/**
 * Remove any relative path components from the given path
 * @param {string[]} items Filesystem path items to filter
 * @return {string[]} Filtered filesystem path items
 */
const filterRelativePathItems = (items) => items.filter((part) => part !== '')

/**
 * Return the default Netlify Graph configuration for a generic site
 * @param {object} input
 * @param {object} input.baseConfig
 * @param {string[]} input.detectedFunctionsPath
 * @param {string[]} input.siteRoot
 */
const makeDefaultNetlifyGraphConfig = ({ baseConfig, detectedFunctionsPath }) => {
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
 * @param {object} input
 * @param {object} input.baseConfig
 * @param {string[]} input.detectedFunctionsPath
 * @param {string[]} input.siteRoot
 */
const makeDefaultNextJsNetlifyGraphConfig = ({ baseConfig, siteRoot }) => {
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
 * @param {object} input
 * @param {object} input.baseConfig
 * @param {string[]} input.detectedFunctionsPath
 * @param {string[]} input.siteRoot
 */
const makeDefaultRemixNetlifyGraphConfig = ({ baseConfig, detectedFunctionsPath, siteRoot }) => {
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
  'Next.js': makeDefaultNextJsNetlifyGraphConfig,
  Remix: makeDefaultRemixNetlifyGraphConfig,
  default: makeDefaultNetlifyGraphConfig,
}

/**
 * Return a full NetlifyGraph config with any defaults overridden by netlify.toml
 * @param {object} input
 * @param {import('../../commands/base-command.mjs').default} input.command
 * @param {import('commander').CommandOptions} input.options
 * @param {Partial<import('../../utils/types').ServerSettings>=} input.settings
 * @return {Promise<NetlifyGraph.NetlifyGraphConfig>} NetlifyGraphConfig
 */
const getNetlifyGraphConfig = async ({ command, options, settings }) => {
  const { config, site } = command.netlify
  config.dev = { ...config.dev }
  config.build = { ...config.build }
  const userSpecifiedConfig = (config && config.graph) || {}
  /** @type {import('../../commands/dev/types').DevConfig} */
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
      warn(
        `Error while auto-detecting project settings, Netlify Graph encountered problems: ${JSON.stringify(
          detectServerSettingsError,
          null,
          2,
        )}`,
      )
    }
  }

  const defaulFunctionsPath = ['netlify', 'functions']

  const siteRoot = [path.sep, ...filterRelativePathItems(site.root.split(path.sep))]

  const tsConfig = 'tsconfig.json'
  const autodetectedLanguage = fs.existsSync(tsConfig) ? 'typescript' : 'javascript'

  const framework = settings.framework || userSpecifiedConfig.framework
  const makeDefaultFrameworkConfig = defaultFrameworkLookup[framework] || defaultFrameworkLookup.default

  const detectedFunctionsPathString = getFunctionsDir({ config, options })
  const detectedFunctionsPath = detectedFunctionsPathString
    ? [path.sep, ...detectedFunctionsPathString.split(path.sep)]
    : defaulFunctionsPath
  const baseConfig = { ...NetlifyGraph.defaultNetlifyGraphConfig, ...userSpecifiedConfig }
  const defaultFrameworkConfig = makeDefaultFrameworkConfig({ baseConfig, detectedFunctionsPath, siteRoot })

  const userSpecifiedFunctionPath =
    userSpecifiedConfig.functionsPath && userSpecifiedConfig.functionsPath.split(path.sep)

  const functionsPath =
    (userSpecifiedFunctionPath && [...siteRoot, ...userSpecifiedFunctionPath]) || defaultFrameworkConfig.functionsPath
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
  const graphQLConfigJsonFilename =
    (userSpecifiedConfig.graphQLConfigJsonFilename && userSpecifiedConfig.graphQLConfigJsonFilename.split(path.sep)) ||
    defaultFrameworkConfig.graphQLConfigJsonFilename ||
    baseConfig.graphQLConfigJsonFilename
  const graphQLSchemaFilename =
    (userSpecifiedConfig.graphQLSchemaFilename && userSpecifiedConfig.graphQLSchemaFilename.split(path.sep)) ||
    defaultFrameworkConfig.graphQLSchemaFilename
  const netlifyGraphRequirePath =
    (userSpecifiedConfig.netlifyGraphRequirePath && userSpecifiedConfig.netlifyGraphRequirePath.split(path.sep)) ||
    defaultFrameworkConfig.netlifyGraphRequirePath
  const moduleType =
    (userSpecifiedConfig.moduleType && userSpecifiedConfig.moduleType.split(path.sep)) ||
    defaultFrameworkConfig.moduleType
  const language = userSpecifiedConfig.language || autodetectedLanguage
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
    graphQLConfigJsonFilename,
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
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureNetlifyGraphPath = (netlifyGraphConfig) => {
  const fullPath = path.resolve(...netlifyGraphConfig.netlifyGraphPath)
  fs.mkdirSync(fullPath, { recursive: true })
}

/**
 * Given a NetlifyGraphConfig, ensure that the functionsPath exists
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 */
const ensureFunctionsPath = (netlifyGraphConfig) => {
  const fullPath = path.resolve(...netlifyGraphConfig.functionsPath)
  fs.mkdirSync(fullPath, { recursive: true })
}

let disablePrettierDueToPreviousError = false

const runPrettier = async (filePath) => {
  if (disablePrettierDueToPreviousError) {
    return
  }

  try {
    const commandProcess = execa('prettier', ['--write', filePath], {
      preferLocal: true,
      // windowsHide needs to be false for child process to terminate properly on Windows
      windowsHide: false,
    })

    await commandProcess
    // eslint-disable-next-line unicorn/prefer-optional-catch-binding
  } catch (prettierError) {
    // It would be nice to log this error to help debugging, but it's potentially a bit scary for the dev to see it
    if (!disablePrettierDueToPreviousError) {
      disablePrettierDueToPreviousError = true
      warn("Error while running prettier, make sure you have installed it globally with 'npm i -g prettier'")
    }
  }
}

/**
 * Generate a library file with type definitions for a given NetlifyGraphConfig, operationsDoc, and schema, returning the in-memory source
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The schema to use when generating the functions and their types
 * @param {string} input.schemaId The id of the schema to use when fetching Graph data
 * @param {string} input.operationsDoc The GraphQL operations doc to use when generating the functions
 * @param {Record<string, NetlifyGraph.ExtractedFunction>} input.functions The parsed queries with metadata to use when generating library functions
 * @param {Record<string, NetlifyGraph.ExtractedFragment>} input.fragments The parsed queries with metadata to use when generating library functions
 * @param {import('netlify-onegraph-internal').CodegenHelpers.GenerateRuntimeFunction} input.generate
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<import('netlify-onegraph-internal').CodegenHelpers.NamedExportedFile[]>} In-memory files
 */
const generateRuntimeSource = async ({
  fragments,
  functions,
  generate,
  netlifyGraphConfig,
  operationsDoc,
  schema,
  schemaId,
}) => {
  const runtime = await NetlifyGraph.generateRuntime({
    GraphQL,
    netlifyGraphConfig,
    schema,
    operationsDoc,
    operations: functions,
    fragments,
    generate,
    schemaId,
  })

  return runtime
}

/**
 * Generate a library file with type definitions for a given NetlifyGraphConfig, operationsDoc, and schema, writing them to the filesystem
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The schema to use when generating the functions and their types
 * @param {string} input.schemaId The id of the schema to use when fetching Graph data
 * @param {string} input.operationsDoc The GraphQL operations doc to use when generating the functions
 * @param {Record<string, NetlifyGraph.ExtractedFunction>} input.functions The parsed queries with metadata to use when generating library functions
 * @param {Record<string, NetlifyGraph.ExtractedFragment>} input.fragments The parsed queries with metadata to use when generating library functions
 * @param {import('netlify-onegraph-internal').CodegenHelpers.GenerateRuntimeFunction} input.generate
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<void>} Void, effectfully writes the generated library to the filesystem
 */
const generateRuntime = async ({
  fragments,
  functions,
  generate,
  logger,
  netlifyGraphConfig,
  operationsDoc,
  schema,
  schemaId,
}) => {
  const runtime = await generateRuntimeSource({
    netlifyGraphConfig,
    schema,
    operationsDoc,
    functions,
    fragments,
    generate,
    schemaId,
  })

  runtime.forEach((file) => {
    const implementationResolvedPath = path.resolve(...file.name)
    fs.writeFileSync(implementationResolvedPath, file.content, 'utf8')
    const implementationRelativePath = path.relative(process.cwd(), implementationResolvedPath)
    logger && logger(`Wrote ${chalk.cyan(implementationRelativePath)}`)
    runPrettier(path.resolve(...file.name))
  })
}

/**
 * Generate a library file with type definitions for a given NetlifyGraphConfig, operationsDoc, and schema, writing them to the filesystem
 * @param {object} input
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {object} input.config The parsed netlify.toml file
 * @param {string} input.schemaId
 * @param {GraphQL.GraphQLSchema} input.schema The schema to use when generating the functions and their types
 * @param {string} input.operationsDoc The GraphQL operations doc to use when generating the functions
 * @param {Record<string, NetlifyGraph.ExtractedFunction>} input.functions The parsed queries with metadata to use when generating library functions
 * @param {Record<string, NetlifyGraph.ExtractedFragment>} input.fragments The parsed queries with metadata to use when generating library functions
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<void>} Void, effectfully writes the generated library to the filesystem
 */
const generateFunctionsFile = async ({ config, netlifyGraphConfig, operationsDoc, schema, schemaId }) => {
  const parsedDoc = GraphQL.parse(operationsDoc)

  const extracted = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

  const codegenModule = await getCodegenModule({ config })
  if (!codegenModule) {
    warn(
      `No Netlify Graph codegen module specified in netlify.toml under the [graph] header. Please specify 'codeGenerator' field and try again.`,
    )
    return
  }

  await generateRuntime({
    generate: codegenModule.generateRuntime,
    schema,
    schemaId,
    netlifyGraphConfig,
    logger: log,
    fragments: extracted.fragments,
    functions: extracted.functions,
    operationsDoc,
  })
}

/**
 * Using the given NetlifyGraphConfig, read the GraphQL operations file and return the _unparsed_ GraphQL operations doc
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string} GraphQL operations doc
 */
const readGraphQLOperationsSourceFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)

  const fullFilename = path.resolve(...(netlifyGraphConfig.graphQLOperationsSourceFilename || []))
  if (!fs.existsSync(fullFilename)) {
    fs.writeFileSync(fullFilename, '')
    fs.closeSync(fs.openSync(fullFilename, 'w'))
  }

  const source = fs.readFileSync(fullFilename, 'utf8')

  return source
}

/**
 * Write an operations doc to the filesystem using the given NetlifyGraphConfig
 * @param {object} input
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {string} input.operationsDocString The GraphQL operations doc to write
 */
const writeGraphQLOperationsSourceFile = ({ logger, netlifyGraphConfig, operationsDocString }) => {
  const graphqlSource = operationsDocString

  ensureNetlifyGraphPath(netlifyGraphConfig)
  const resolvedPath = path.resolve(...(netlifyGraphConfig.graphQLOperationsSourceFilename || []))
  fs.writeFileSync(resolvedPath, graphqlSource, 'utf8')
  const relativePath = path.relative(process.cwd(), resolvedPath)
  logger && logger(`Wrote ${chalk.cyan(relativePath)}`)
}

/**
 * Write a GraphQL Schema printed in SDL format to the filesystem using the given NetlifyGraphConfig
 * @param {object} input
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to print and write to the filesystem
 */
const writeGraphQLSchemaFile = ({ logger, netlifyGraphConfig, schema }) => {
  const graphqlSource = printSchema(schema)

  ensureNetlifyGraphPath(netlifyGraphConfig)
  const resolvedPath = path.resolve(...netlifyGraphConfig.graphQLSchemaFilename)
  fs.writeFileSync(resolvedPath, graphqlSource, 'utf8')
  const relativePath = path.relative(process.cwd(), resolvedPath)
  logger && logger(`Wrote ${chalk.cyan(relativePath)}`)
}

/**
 * Using the given NetlifyGraphConfig, read the GraphQL schema file and return it _unparsed_
 * @param {NetlifyGraph.NetlifyGraphConfig} netlifyGraphConfig
 * @returns {string} GraphQL schema
 */
const readGraphQLSchemaFile = (netlifyGraphConfig) => {
  ensureNetlifyGraphPath(netlifyGraphConfig)
  return fs.readFileSync(path.resolve(...netlifyGraphConfig.graphQLSchemaFilename), 'utf8')
}

/**
 * Given a NetlifyGraphConfig, read the appropriate files and write a handler for the given operationId to the filesystem
 * @param {object} input
 * @param {import('netlify-onegraph-internal').CodegenHelpers.GenerateHandlerFunction} input.generate
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating the handler
 * @param {string} input.operationId The operationId to use when generating the handler
 * @param {string} input.operationsDoc The document containing the operation with operationId and any fragment dependency to use when generating the handler
 * @param {object} input.handlerOptions The options to use when generating the handler
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<{exportedFiles: import('netlify-onegraph-internal').CodegenHelpers.ExportedFile[]; operation: GraphQL.OperationDefinitionNode;} | undefined>} The generated files
 */
const generateHandlerSourceByOperationId = async ({
  generate,
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  schema,
}) => {
  const generateHandlerPayload = {
    GraphQL,
    generate,
    handlerOptions,
    schema,
    schemaString: GraphQL.printSchema(schema),
    netlifyGraphConfig,
    operationId,
    operationsDoc,
  }

  const result = await NetlifyGraph.generateCustomHandlerSource(generateHandlerPayload)

  return result
}

/**
 * Given a NetlifyGraphConfig, read the appropriate files and write a handler for the given operationId to the filesystem
 * @param {object} input
 * @param {import('netlify-onegraph-internal').CodegenHelpers.GenerateHandlerFunction} input.generate
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating the handler
 * @param {string} input.operationId The operationId to use when generating the handler
 * @param {object} input.handlerOptions The options to use when generating the handler
 * @param {(message: string) => void=} input.logger A function that if provided will be used to log messages
 * @returns {Promise<Array<{filePath: string, name:string, prettierSuccess: boolean}> | undefined>} An array of the generated handler filepaths
 */
const generateHandlerByOperationId = async ({ generate, handlerOptions, netlifyGraphConfig, operationId, schema }) => {
  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = NetlifyGraph.defaultExampleOperationsDoc
  }

  const result = await generateHandlerSourceByOperationId({
    generate,
    handlerOptions,
    netlifyGraphConfig,
    operationId,
    operationsDoc: currentOperationsDoc,
    schema,
  })

  if (!result) {
    warn(`No handler was generated for operationId ${operationId}`)
    return
  }

  const { exportedFiles, operation } = result

  log('Ensure destination path exists...')

  ensureFunctionsPath(netlifyGraphConfig)

  if (!exportedFiles) {
    warn(`No exported files from Netlify Graph code generator`)
    return
  }

  /** @type {Array<{filePath: string, name:string, prettierSuccess: boolean}>} */
  const results = []

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
    const relativePath = path.relative(process.cwd(), absoluteFilename)
    log(`Wrote ${chalk.cyan(relativePath)}`)
    runPrettier(absoluteFilename)

    results.push({
      name: filenameArr.slice(-1)[0],
      filePath: absoluteFilename,
      prettierSuccess: true,
    })
  })

  return results
}

/**
 * Given a NetlifyGraphConfig, read the appropriate files and write a handler for the given operationId to the filesystem
 * @param {object} input
 * @param {import('netlify-onegraph-internal').CodegenHelpers.GenerateHandlerFunction} input.generate
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating the handler
 * @param {string} input.operationName The name of the operation to use when generating the handler
 * @param {object} input.handlerOptions The options to use when generating the handler
 * @param {(message: string) => void} input.logger A function that if provided will be used to log messages
 * @returns {Promise<void>}
 */
const generateHandlerByOperationName = async ({
  generate,
  handlerOptions,
  logger,
  netlifyGraphConfig,
  operationName,
  schema,
}) => {
  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = NetlifyGraph.defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { fragments, functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

  const functionDefinition = Object.values(functions).find(
    (potentialDefinition) => potentialDefinition.operationName === operationName,
  )

  const fragmentDefinition = Object.values(fragments).find(
    (potentialDefinition) => potentialDefinition.fragmentName === operationName,
  )

  const definition = functionDefinition || fragmentDefinition

  if (!definition) {
    warn(`No operation named ${operationName} was found in the operations doc`)
    return
  }

  await generateHandlerByOperationId({
    logger,
    generate,
    netlifyGraphConfig,
    schema,
    operationId: definition.id,
    handlerOptions,
  })
}

/**
 * Given a NetlifyGraphConfig, read the appropriate files and write a handler for the given operationId to the filesystem
 * @param {object} input
 * @param {import('netlify-onegraph-internal').CodegenHelpers.GenerateHandlerPreviewFunction} input.generate
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema The GraphQL schema to use when generating the handler
 * @param {string} input.operationName The name of the operation to use when generating the handler
 * @param {object} input.handlerOptions The options to use when generating the handler
 * @param {(message: string) => void} input.logger A function that if provided will be used to log messages
 * @returns {import('netlify-onegraph-internal').CodegenHelpers.ExportedFile | undefined}
 */
const generateHandlerPreviewByOperationName = ({
  generate,
  handlerOptions,
  netlifyGraphConfig,
  operationName,
  schema,
}) => {
  let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = NetlifyGraph.defaultExampleOperationsDoc
  }

  const parsedDoc = parse(currentOperationsDoc)
  const { functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

  const operation = Object.values(functions).find(
    (potentialOperation) => potentialOperation.operationName === operationName,
  )

  if (!operation) {
    warn(`No operation named ${operationName} was found in the operations doc`)
    return
  }

  const generateHandlerPreviewPayload = {
    GraphQL,
    generate,
    handlerOptions,
    schema,
    schemaString: GraphQL.printSchema(schema),
    netlifyGraphConfig,
    operationId: operation.id,
    operationsDoc: currentOperationsDoc,
  }

  const preview = NetlifyGraph.generatePreview(generateHandlerPreviewPayload)

  if (!preview) {
    return
  }

  return preview.exportedFile
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
  const url = `http://${host}/sites/app/${siteName}/graph/explorer/${oneGraphSessionId}`

  return url
}

/**
 * Get a url to the Netlify Graph UI for the current session by a site's id
 * @param {object} options
 * @param {string} options.siteId The name of the site as used in the Netlify UI url scheme
 * @param {string} options.oneGraphSessionId The oneGraph session id to use when generating the graph-edit link
 * @returns {string} The url to the Netlify Graph UI for the current session
 */
const getGraphEditUrlBySiteId = ({ oneGraphSessionId, siteId }) => {
  const host = process.env.NETLIFY_APP_HOST || 'app.netlify.com'
  // http because app.netlify.com will redirect to https, and localhost will still work for development
  const url = `http://${host}/site-redirect/${siteId}/graph/explorer/${oneGraphSessionId}`

  return url
}

/**
 * Load `netlifyGraph.json` from the appropriate location
 * @param {string} siteRoot The root directory of the site
 * @returns {import('netlify-onegraph-internal').NetlifyGraphJsonConfig.JsonConfig}
 */
const loadNetlifyGraphConfig = (siteRoot) => {
  const configPath = path.join(siteRoot, 'netlifyGraph.json')
  if (fs.existsSync(configPath)) {
    // eslint-disable-next-line unicorn/prefer-json-parse-buffer
    const file = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(file)
  }

  return {}
}

const autocompleteOperationNames = async ({ netlifyGraphConfig }) => {
  try {
    let currentOperationsDoc = readGraphQLOperationsSourceFile(netlifyGraphConfig)
    if (currentOperationsDoc.trim().length === 0) {
      currentOperationsDoc = NetlifyGraph.defaultExampleOperationsDoc
    }

    const parsedDoc = parse(currentOperationsDoc)
    const extracted = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)

    const { functions } = extracted

    const sorted = Object.values(functions).sort((aItem, bItem) =>
      aItem.operationName.localeCompare(bItem.operationName),
    )

    const perPage = 50

    const allOperationChoices = sorted.map((operation) => ({
      name: `${operation.operationName} (${operation.kind})`,
      value: operation.operationName,
    }))

    const filterOperationNames = (operationChoices, input) =>
      operationChoices.filter((operation) => operation.value.toLowerCase().match(input.toLowerCase()))

    /** multiple matching detectors, make the user choose */
    // @ts-ignore
    inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)

    // @ts-ignore
    const { selectedOperationName } = await inquirer.prompt({
      name: 'selectedOperationName',
      message: `For which operation would you like to generate a handler?`,
      type: 'autocomplete',
      pageSize: perPage,
      source(_, input) {
        if (!input || input === '') {
          return allOperationChoices
        }

        const filteredChoices = filterOperationNames(allOperationChoices, input)
        // only show filtered results
        return filteredChoices
      },
    })

    return selectedOperationName
  } catch (parseError) {
    error(`Error parsing operations library: ${parseError}`)
  }
}

/** @type {string | undefined} */
let lastWarnedFailedCodegenModule

/**
 * @param {object} input
 * @param {object} input.config The parsed netlify.toml file
 * @param {string=} input.cwd The optional directory to use as a base path when resolving codegen modules
 * @returns {Promise<import('netlify-onegraph-internal').CodegenHelpers.CodegenModule | void>} codegenModule
 */
const dynamicallyLoadCodegenModule = async ({ config, cwd }) => {
  const basePath = cwd || process.cwd()
  const importPath = config.graph && config.graph.codeGenerator

  if (!importPath) {
    return
  }

  // We currently include some default code generators for the most common framework
  // use-cases. We still require it to be explicitly configured in netlify.toml,
  // but we don't require an additional package install for it.
  const includedCodegenModule = IncludedCodegen.includedCodegenModules.find(
    (codegenModule) => codegenModule.sigil === importPath,
  )

  if (includedCodegenModule) {
    return includedCodegenModule
  }

  try {
    if (!importPath) {
      warn(
        `No Netlify Graph codegen module specified in netlify.toml under the [graph] header. Please specify 'codeGenerator' field and try again.`,
      )
      return
    }

    const absolute = [basePath, 'node_modules', ...importPath.split('/'), 'index.js']
    const relativePath = path.join(basePath, importPath)
    const absoluteOrNodePath = path.resolve(...absolute)

    const finalPath = fs.existsSync(relativePath) ? relativePath : pathToFileURL(absoluteOrNodePath).href

    /** @type {import('netlify-onegraph-internal').CodegenHelpers.CodegenModule | undefined} */
    // eslint-disable-next-line import/no-dynamic-require
    const newModule = await import(finalPath)

    if (newModule) {
      const hasGenerators = Array.isArray(newModule.generators)
      let generatorsConform = true
      if (hasGenerators) {
        newModule.generators.forEach((generator) => {
          const hasId = Boolean(generator.id)
          const hasName = Boolean(generator.name)
          const hasVersion = Boolean(generator.version)
          const hasGenerator = Boolean(generator.generateHandler)

          if (!hasId || !hasName || !hasVersion || !hasGenerator) {
            generatorsConform = false
          }
        })
      }

      if (!generatorsConform) {
        warn(`Generator ${importPath} does not conform to expected module declaration type, ignoring...`)
        return
      }
    }

    return newModule
  } catch (error_) {
    if (lastWarnedFailedCodegenModule !== importPath) {
      warn(`Failed to load Graph code generator, please make sure that "${importPath}" either exists as a local file or is listed in your package.json under devDependencies, and can be 'require'd or 'import'ed.

${error_}`)

      lastWarnedFailedCodegenModule = importPath
    }
  }
}

const getCodegenModule = ({ config }) => dynamicallyLoadCodegenModule({ config })

const getCodegenFunctionById = async ({ config, id }) => {
  const codegenModule = await getCodegenModule({ config })

  return codegenModule && codegenModule.generators && codegenModule.generators.find((generator) => generator.id === id)
}

const autocompleteCodegenModules = async ({ config }) => {
  const codegenModule = await getCodegenModule({ config })
  if (!codegenModule || !codegenModule.generators) {
    return null
  }

  log(`Using Graph Codegen module ${codegenModule.id} [${codegenModule.version}] from '${config.graph.codeGenerator}'`)

  const allGeneratorChoices = codegenModule.generators
    // eslint-disable-next-line id-length
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((codeGen) => ({
      name: `${codeGen.name} [${codeGen.id}]`,
      value: codeGen.name,
    }))

  // eslint-disable-next-line unicorn/consistent-function-scoping
  const filterModuleNames = (moduleChoices, input) =>
    moduleChoices.filter((moduleChoice) => moduleChoice.name.toLowerCase().match(input.toLowerCase()))

  /** multiple matching detectors, make the user choose */
  // @ts-ignore
  inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)

  const perPage = 50

  // @ts-ignore
  const { selectedCodeGen } = await inquirer.prompt({
    name: 'selectedCodeGen',
    message: `Which codegen would you like to use?`,
    type: 'autocomplete',
    pageSize: perPage,
    source(_, input) {
      if (!input || input === '') {
        return allGeneratorChoices
      }

      const filteredChoices = filterModuleNames(allGeneratorChoices, input)
      // only show filtered results
      return filteredChoices
    },
  })

  return codegenModule.generators.find(
    (dynamicallyImportedModule) => dynamicallyImportedModule.name === selectedCodeGen,
  )
}

export {
  autocompleteCodegenModules,
  autocompleteOperationNames,
  buildSchema,
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  generateHandlerSource,
  generateHandlerByOperationId,
  generateHandlerByOperationName,
  generateHandlerPreviewByOperationName,
  generateHandlerSourceByOperationId,
  generateRuntime,
  generateRuntimeSource,
  getCodegenFunctionById,
  getCodegenModule,
  getGraphEditUrlBySiteId,
  getGraphEditUrlBySiteName,
  getNetlifyGraphConfig,
  loadNetlifyGraphConfig,
  normalizeOperationsDoc,
  parse,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
  setNetlifyTomlCodeGeneratorModule,
  runPrettier,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
}
