/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
// @ts-check
const fs = require('fs')
const path = require('path')
const process = require('process')

const test = require('ava')
const { CodegenHelpers, GraphQL, IncludedCodegen, NetlifyGraph } = require('netlify-onegraph-internal')
const { registerConsole } = require('netlify-onegraph-internal/dist/internalConsole')

const {
  generateHandlerSourceByOperationId,
  generateRuntimeSource,
  runPrettier,
} = require('../../src/lib/one-graph/cli-netlify-graph')
const { buildSchema, extractFunctionsFromOperationDoc, parse } = require('../../src/lib/one-graph/cli-netlify-graph')

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
  graphQLOperationsSourceDirectory: ['dummy'],
}

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
 * @param {CodegenHelpers.Codegen} input.codegen
 * @param {string} input.operationId
 * @param {string} input.operationsDoc
 * @param {NetlifyGraph.NetlifyGraphConfig} input.netlifyGraphConfig
 * @param {GraphQL.GraphQLSchema} input.schema
 * @param {string[]} input.outDir
 * @returns {[string, string][] | void} - [filename, content]
 */
const generateHandlerText = ({
  codegen,
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  outDir,
  schema,
}) => {
  const result = generateHandlerSourceByOperationId({
    generate: codegen.generateHandler,
    netlifyGraphConfig,
    schema,
    operationId,
    operationsDoc,
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

    const filePathArr = [...outDir, ...baseFilenameArr].map((step) => step.replace(':', '___'))

    const filePath = path.resolve(...filePathArr)
    const parentDir = filePathArr.slice(0, -1)

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

/**
 * @param {object} input
 * @param {CodegenHelpers.CodegenModule} input.codegenModule
 */
const testGenerateRuntime = async ({ codegenModule }) => {
  /**
   *
   * @param {CodegenHelpers.NamedExportedFile} file
   * @returns {void}
   */
  const writeFile = (file) => {
    const outDirPath = path.join(process.cwd(), '_test_out')
    const outDir = [
      path.sep,
      ...outDirPath.split(path.sep),
      `netlify-graph-test-${codegenModule.id}-${codegenModule.version}`,
    ]

    const filePathArr = [...outDir, ...file.name].map((step) => step.replace(':', '___'))

    const filePath = path.resolve(...filePathArr)
    const parentDir = filePathArr.slice(0, -1)

    ensurePath(parentDir)
    fs.writeFileSync(filePath, file.content, 'utf8')
    // Run prettier to help normalize the output (and also make sure we're generating parsable code)
    runPrettier(filePath)
  }

  /**
   * @constant
   * @type {NetlifyGraph.NetlifyGraphConfig}
   */
  const netlifyGraphConfig = { ...baseNetlifyGraphConfig }

  const { fragments, functions } = extractFunctionsFromOperationDoc(GraphQL, parsedDoc)
  const generatedRuntime = await generateRuntimeSource({
    generate: codegenModule.generateRuntime,
    netlifyGraphConfig,
    schema: commonSchema,
    schemaId: 'stable-schema-id',
    operationsDoc: appOperationsDoc,
    functions,
    fragments,
  })

  generatedRuntime.forEach((runtimeFile) => {
    writeFile(runtimeFile)
  })

  generatedRuntime.forEach((runtimeFile) => {
    const filepath = runtimeFile.name.map((step) => step.replace(':', '___')).join('/')
    // @ts-ignore
    test(`netlify graph function library runtime codegen library [${codegenModule.id}-${codegenModule.version}]:./${filepath}}`, (t) => {
      t.snapshot(runtimeFile.content)
    })
  })
}

/**
 *
 * @param {object} input
 * @param {CodegenHelpers.CodegenModule} input.codegenModule
 * @param {string} input.builtInCodegenId
 * @param {string} input.operationId
 */
const testGenerateHandlerSource = ({ builtInCodegenId, codegenModule, operationId }) => {
  const outDirPath = path.join(process.cwd(), '_test_out')
  const outDir = [path.sep, ...outDirPath.split(path.sep), `netlify-graph-test-${builtInCodegenId}`]

  const codegen = codegenModule.generators.find((generator) => generator.id === builtInCodegenId)

  if (!codegen) {
    console.warn(`No built-in codegen found with id "${builtInCodegenId}"`)
    return
  }

  /**
   * @constant
   * @type {NetlifyGraph.NetlifyGraphConfig}
   */
  const netlifyGraphConfig = { ...baseNetlifyGraphConfig }

  /**
   * @constant
   * @type Record<string, any>
   */
  const handlerOptions = {}
  const textualSources =
    generateHandlerText({
      codegen,
      handlerOptions,
      netlifyGraphConfig,
      operationId,
      operationsDoc: appOperationsDoc,
      schema: commonSchema,
      outDir,
    }) || []

  textualSources.forEach(([filename, content]) => {
    // @ts-ignore
    test(`netlify graph handler codegen [${codegen.id}-${codegen.version}]:/${filename}`, (t) => {
      t.snapshot(normalize(JSON.stringify(content)))
    })
  })
}

const builtInCodegenModules = IncludedCodegen.includedCodegenModules

const queryWithFragmentOperationId = 'e2394c86-260c-4646-88df-7bc7370de666'

builtInCodegenModules.forEach((codegenModule) => {
  registerConsole(console)

  testGenerateRuntime({
    codegenModule,
  })
})

const subscriptionWithFragmentOperationId = 'e3d4bb8b-2fb5-9898-b051-db6027224112'
builtInCodegenModules.forEach((codegenModule) => {
  registerConsole(console)

  codegenModule.generators.forEach((codegen) => {
    testGenerateHandlerSource({
      codegenModule,
      operationId: subscriptionWithFragmentOperationId,
      builtInCodegenId: codegen.id,
    })
  })
})
