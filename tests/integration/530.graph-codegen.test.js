/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
// @ts-check
const fs = require('fs')
const path = require('path')
const process = require('process')

const test = require('ava')
const { GraphQL, NetlifyGraph } = require('netlify-onegraph-internal')

const { runPrettier } = require('../../src/lib/one-graph/cli-netlify-graph')
const {
  buildSchema,
  extractFunctionsFromOperationDoc,
  generateFunctionsSource,
  generateHandlerSource,
  parse,
} = require('../../src/lib/one-graph/cli-netlify-graph')

const { normalize } = require('./utils/snapshots')

/**
 * Given a path, ensure that the path exists
 * @param {string[]} filePath
 */
const ensurePath = (filePath) => {
  const fullPath = path.resolve(...filePath)
  fs.mkdirSync(fullPath, { recursive: true })
}

/**
 * @constant
 * @type {NetlifyGraph.NetlifyGraphConfig}
 */
const baseNetlifyGraphConfig = {
  extension: 'js',
  netlifyGraphPath: ['netlify'],
  graphQLConfigJsonFilename: ['.graphqlrc.json'],
  moduleType: 'esm',
  functionsPath: ['functions'],
  netlifyGraphImplementationFilename: ['dummy', 'index.js'],
  netlifyGraphTypeDefinitionsFilename: ['dummy', 'index.d.ts'],
  graphQLOperationsSourceFilename: ['dummy', 'netlifyGraphOperationsLibrary.graphql'],
  graphQLSchemaFilename: ['dummy', 'netlifyGraphSchema.graphql'],
  webhookBasePath: '/webhooks',
  netlifyGraphRequirePath: ['.', 'netlifyGraph'],
  framework: '#custom',
  language: 'javascript',
  runtimeTargetEnv: 'node',
}

/**
 * @constant
 * @type {("esm" | "commonjs")[]}
 */
const moduleTypes = [
  'esm',
  /**
   * Restore this when we have a way to generate commonjs modules with typescript enabled
   */
  //  'commonjs'
]

const loadAsset = (filename) => fs.readFileSync(path.join(__dirname, 'assets', filename), 'utf8')
const schemaString = loadAsset('../assets/netlifyGraphSchema.graphql')
const commonSchema = buildSchema(schemaString)

const appOperationsDoc = loadAsset('../assets/netlifyGraphOperationsLibrary.graphql')
const parsedDoc = parse(appOperationsDoc, {
  noLocation: true,
})

/**
 *
 * @param {object} input
 * @param {Record<string, any>} input.handlerOptions
 * @param {string} input.operationId
 * @param {string} input.operationsDoc
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema
 * @param {string[]} input.outDir
 * @returns {[string, string][]} - [filename, content]
 */
const generateHandlerText = ({ handlerOptions, netlifyGraphConfig, operationId, operationsDoc, outDir, schema }) => {
  const result = generateHandlerSource({
    netlifyGraphConfig,
    schema,
    operationsDoc,
    operationId,
    handlerOptions,
  })

  if (!result) {
    return
  }

  const { exportedFiles, operation } = result

  if (!exportedFiles) {
    return
  }

  const sources = []

  exportedFiles.forEach((exportedFile) => {
    const { content } = exportedFile
    const isNamed = exportedFile.kind === 'NamedExportedFile'

    let baseFilenameArr

    if (isNamed) {
      baseFilenameArr = [...exportedFile.name]
    } else {
      const operationName = (operation.name && operation.name.value) || 'Unnamed'
      const fileExtension = netlifyGraphConfig.language === 'typescript' ? 'ts' : netlifyGraphConfig.extension
      const defaultBaseFilename = `${operationName}.${fileExtension}`
      const baseFilename = defaultBaseFilename

      baseFilenameArr = [baseFilename]
    }

    const filenameArr = [...outDir, ...baseFilenameArr]

    const filePath = path.resolve(...filenameArr)
    const parentDir = filenameArr.slice(0, -1)

    ensurePath(parentDir)
    fs.writeFileSync(filePath, content, 'utf8')
    // Run prettier to help normalize the output
    runPrettier(filePath)

    const prettierContent = fs.readFileSync(filePath, 'utf-8')

    sources.push([filePath, baseFilenameArr, prettierContent])
  })

  if (sources.length === 0) {
    console.warn(`No exported files found for operation ${operationId}`)
  }

  const textualSource = sources
    .sort(([filenameA], [filenameB]) => filenameA[0].localeCompare(filenameB[0]))
    .map(([_, baseFilenameArr, content]) => {
      // Strip the outDir from the filename so the output is the same regardless of where the tests are run
      const filename = baseFilenameArr.join('/')
      return [filename, content]
    })

  // @ts-ignore
  return textualSource
}

const testGenerateFunctionLibraryAndRuntime = ({ frameworkName, language, name, runtimeTargetEnv }) => {
  moduleTypes.forEach((moduleType) => {
    const outDirPath = path.join(process.cwd(), '_test_out')
    const outDir = [path.sep, ...outDirPath.split(path.sep), `netlify-graph-test-${frameworkName}-${moduleType}`]

    /**
     * @constant
     * @type {NetlifyGraph.NetlifyGraphConfig}
     */
    const netlifyGraphConfig = { ...baseNetlifyGraphConfig, runtimeTargetEnv, moduleType }

    const { fragments, functions } = extractFunctionsFromOperationDoc(parsedDoc)
    const generatedFunctions = generateFunctionsSource(
      netlifyGraphConfig,
      commonSchema,
      appOperationsDoc,
      functions,
      fragments,
    )
    const clientDefinitionsFilenameArr = [...outDir, 'netlifyGraph', 'index.js']
    const typescriptFilenameArr = [...outDir, 'netlifyGraph', 'index.d.ts']

    const writeFile = (filenameArr, content) => {
      const filePath = path.resolve(...filenameArr)
      const parentDir = filenameArr.slice(0, -1)

      ensurePath(parentDir)
      fs.writeFileSync(filePath, content, 'utf8')
      // Run prettier to help normalize the output (and also make sure we're generating parsable code)
      runPrettier(filePath)
    }

    writeFile(typescriptFilenameArr, generatedFunctions.typeDefinitionsSource)
    writeFile(clientDefinitionsFilenameArr, generatedFunctions.clientSource)

    const prettierGeneratedFunctions = {
      functionDefinitions: generatedFunctions.functionDefinitions,
      typeDefinitionsSource: fs.readFileSync(path.resolve(...typescriptFilenameArr), 'utf-8'),
      clientSource: fs.readFileSync(path.resolve(...clientDefinitionsFilenameArr), 'utf-8'),
    }

    // @ts-ignore
    test(`netlify graph function library (+runtime) codegen library [${frameworkName}-${name}-${language}-${moduleType}]:/netlifyGraph/index.js}`, (t) => {
      t.snapshot(generatedFunctions.clientSource)
    })

    // @ts-ignore
    test(`netlify graph function library (+runtime) codegen [${frameworkName}-${name}-${language}-${moduleType}]:/netlifyGraph/index.d.ts`, (t) => {
      t.snapshot(generatedFunctions.typeDefinitionsSource)
    })
  })
}

const testGenerateHandlerSource = ({ frameworkName, language, name, operationId }) => {
  moduleTypes.forEach((moduleType) => {
    const outDirPath = path.join(process.cwd(), '_test_out')
    const outDir = [path.sep, ...outDirPath.split(path.sep), `netlify-graph-test-${frameworkName}-${moduleType}`]

    /**
     * @constant
     * @type {NetlifyGraph.NetlifyGraphConfig}
     */
    const netlifyGraphConfig = { ...baseNetlifyGraphConfig, framework: frameworkName, language, moduleType }

    /**
     * @constant
     * @type Record<string, any>
     */
    const handlerOptions = {}
    const textualSources = generateHandlerText({
      handlerOptions,
      netlifyGraphConfig,
      operationId,
      operationsDoc: appOperationsDoc,
      schema: commonSchema,
      outDir,
    })

    textualSources.forEach(([filename, content]) => {
      // @ts-ignore
      test(`netlify graph handler codegen [${frameworkName}-${name}-${language}-${moduleType}]:/${filename}`, (t) => {
        t.snapshot(normalize(JSON.stringify(content)))
      })
    })
  })
}

const frameworks = ['#custom', 'Next.js', 'Remix', 'unknown']

const queryWithFragmentOperationId = 'e2394c86-260c-4646-88df-7bc7370de666'
frameworks.forEach((frameworkName) => {
  testGenerateFunctionLibraryAndRuntime({
    frameworkName,
    language: 'javascript',
    name: 'node',
    runtimeTargetEnv: 'node',
  })
  testGenerateFunctionLibraryAndRuntime({
    frameworkName,
    language: 'javascript',
    name: 'browser',
    runtimeTargetEnv: 'browser',
  })
  testGenerateHandlerSource({
    frameworkName,
    operationId: queryWithFragmentOperationId,
    name: 'queryWithFragment',
    language: 'javascript',
  })
})

frameworks.forEach((frameworkName) => {
  testGenerateFunctionLibraryAndRuntime({
    frameworkName,
    language: 'typescript',
    name: 'node',
    runtimeTargetEnv: 'node',
  })
  testGenerateFunctionLibraryAndRuntime({
    frameworkName,
    language: 'typescript',
    name: 'browser',
    runtimeTargetEnv: 'browser',
  })
  testGenerateHandlerSource({
    frameworkName,
    operationId: queryWithFragmentOperationId,
    name: 'queryWithFragment',
    language: 'typescript',
  })
})

const subscriptionWithFragmentOperationId = 'e3d4bb8b-2fb5-9898-b051-db6027224112'
frameworks.forEach((frameworkName) => {
  testGenerateHandlerSource({
    frameworkName,
    operationId: subscriptionWithFragmentOperationId,
    name: 'subscriptionWithFragment',
    language: 'javascript',
  })
})

frameworks.forEach((frameworkName) => {
  testGenerateHandlerSource({
    frameworkName,
    operationId: subscriptionWithFragmentOperationId,
    name: 'subscriptionWithFragment',
    language: 'typescript',
  })
})
