import fs from 'fs'
import path, { dirname } from 'path'
import process from 'process'
import { fileURLToPath } from 'url'

import { CodegenHelpers, GraphQL, IncludedCodegen, NetlifyGraph } from 'netlify-onegraph-internal'
import { registerConsole } from 'netlify-onegraph-internal/dist/internalConsole.js'
import { expect, test } from 'vitest'

import {
  generateHandlerSourceByOperationId,
  generateRuntimeSource,
  runPrettier,
  buildSchema,
  extractFunctionsFromOperationDoc,
  parse,
} from '../../src/lib/one-graph/cli-netlify-graph.mjs'

import { normalize } from './utils/snapshots.cjs'

const dirPath = dirname(fileURLToPath(import.meta.url))

/**
 * Given a path, ensure that the path exists
 */
const ensurePath = (filePath: string[]) => {
  const fullPath = path.resolve(...filePath)
  fs.mkdirSync(fullPath, { recursive: true })
}

const baseNetlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = {
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

const loadAsset = (filename) => fs.readFileSync(path.join(dirPath, 'assets', filename), 'utf8')
const schemaString = loadAsset('../assets/netlifyGraphSchema.graphql')
const commonSchema = buildSchema(schemaString)

const appOperationsDoc = loadAsset('../assets/netlifyGraphOperationsLibrary.graphql')
const parsedDoc = parse(appOperationsDoc, {
  noLocation: true,
})

interface GenerateHandlerTextOptions {
  codegen: CodegenHelpers.Codegen
  handlerOptions: Record<string, any>
  netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig
  operationId: string
  operationsDoc: string
  outDir: string[]
  schema: GraphQL.GraphQLSchema
}

const generateHandlerText = async ({
  codegen,
  handlerOptions,
  netlifyGraphConfig,
  operationId,
  operationsDoc,
  outDir,
  schema,
}: GenerateHandlerTextOptions): Promise<[string, string][] | void> => {
  const result = await generateHandlerSourceByOperationId({
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

  const sources: [string, string[], string][] = []

  exportedFiles.forEach((exportedFile) => {
    const { content } = exportedFile
    const isNamed = exportedFile.kind === 'NamedExportedFile'

    let baseFilenameArr: string[]

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

  const textualSource: [string, string][] = sources
    .sort(([filenameA], [filenameB]) => filenameA[0].localeCompare(filenameB[0]))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, baseFilenameArr, content]) => {
      // Strip the outDir from the filename so the output is the same regardless of where the tests are run
      const filename = baseFilenameArr.join('/')
      return [filename, content]
    })

  return textualSource
}

const testGenerateRuntime = async ({ codegenModule }: { codegenModule: CodegenHelpers.CodegenModule }) => {
  const writeFile = (file: CodegenHelpers.NamedExportedFile): void => {
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

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = { ...baseNetlifyGraphConfig }

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
    test(`netlify graph function library runtime codegen library [${codegenModule.id}-${codegenModule.version}]:./${filepath}}`, () => {
      expect(runtimeFile.content).toMatchSnapshot()
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
const testGenerateHandlerSource = async ({ builtInCodegenId, codegenModule, operationId }) => {
  const outDirPath = path.join(process.cwd(), '_test_out')
  const outDir = [path.sep, ...outDirPath.split(path.sep), `netlify-graph-test-${builtInCodegenId}`]

  const codegen = codegenModule.generators.find((generator) => generator.id === builtInCodegenId)

  if (!codegen) {
    console.warn(`No built-in codegen found with id "${builtInCodegenId}"`)
    return
  }

  const netlifyGraphConfig: NetlifyGraph.NetlifyGraphConfig = { ...baseNetlifyGraphConfig }

  const handlerOptions: Record<string, any> = {}
  const textualSources =
    (await generateHandlerText({
      codegen,
      handlerOptions,
      netlifyGraphConfig,
      operationId,
      operationsDoc: appOperationsDoc,
      schema: commonSchema,
      outDir,
    })) || []

  textualSources.forEach(([filename, content]) => {
    test(`netlify graph handler codegen [${codegen.id}-${codegen.version}]:/${filename}`, () => {
      expect(normalize(JSON.stringify(content))).toMatchSnapshot()
    })
  })
}

const builtInCodegenModules = IncludedCodegen.includedCodegenModules

builtInCodegenModules.forEach((codegenModule) => {
  registerConsole(console)

  testGenerateRuntime({
    codegenModule,
  })
})

const subscriptionWithFragmentOperationId = 'e3d4bb8b-2fb5-9898-b051-db6027224112'
await Promise.all(
  builtInCodegenModules.map(async (codegenModule) => {
    registerConsole(console)

    await Promise.all(
      codegenModule.generators.map(async (codegen) => {
        await testGenerateHandlerSource({
          codegenModule,
          operationId: subscriptionWithFragmentOperationId,
          builtInCodegenId: codegen.id,
        })
      }),
    )
  }),
)
