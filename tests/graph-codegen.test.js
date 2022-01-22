const fs = require('fs')
const { join } = require('path')

const test = require('ava')

const {
  buildSchema,
  extractFunctionsFromOperationDoc,
  generateFunctionsSource,
  generateHandlerSource,
  parse,
} = require('../src/lib/one-graph/cli-netlify-graph')

const { normalize } = require('./utils/snapshots')

const netlifyGraphConfig = {
  extension: 'js',
  netlifyGraphPath: 'netlify',
  moduleType: 'commonjs',
  functionsPath: ['functions'],
  netlifyGraphImplementationFilename: 'dummy/index.js',
  netlifyGraphTypeDefinitionsFilename: 'dummy/index.d.ts',
  graphQLOperationsSourceFilename: 'dummy/netlifyGraphOperationsLibrary.graphql',
  graphQLSchemaFilename: 'dummy/netlifyGraphSchema.graphql',
}

const loadAsset = (filename) => fs.readFileSync(join(__dirname, 'assets', filename), 'utf8')

test('netlify graph function codegen', (t) => {
  const schemaString = loadAsset('../assets/netlifyGraphSchema.graphql')
  const schema = buildSchema(schemaString)

  const appOperationsDoc = loadAsset('../assets/netlifyGraphOperationsLibrary.graphql')
  const parsedDoc = parse(appOperationsDoc, {
    noLocation: true,
  })

  const operations = extractFunctionsFromOperationDoc(parsedDoc)
  const generatedFunctions = generateFunctionsSource(netlifyGraphConfig, schema, appOperationsDoc, operations)

  t.snapshot(normalize(JSON.stringify(generatedFunctions)))
})

test('netlify graph handler codegen', (t) => {
  const schemaString = loadAsset('../assets/netlifyGraphSchema.graphql')
  const schema = buildSchema(schemaString)

  const appOperationsDoc = loadAsset('../assets/netlifyGraphOperationsLibrary.graphql')

  // From the asset GraphQL file
  const operationId = 'd86699fb-ddfc-4833-9d9a-f3497cb7c992'
  const handlerOptions = {}
  const result = generateHandlerSource({
    netlifyGraphConfig,
    schema,
    operationsDoc: appOperationsDoc,
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

    let filenameArr

    if (isNamed) {
      filenameArr = [...exportedFile.name]
    } else {
      const operationName = (operation.name && operation.name.value) || 'Unnamed'
      const fileExtension = netlifyGraphConfig.language === 'typescript' ? 'ts' : netlifyGraphConfig.extension
      const defaultBaseFilename = `${operationName}.${fileExtension}`
      const baseFilename = defaultBaseFilename

      filenameArr = [...netlifyGraphConfig.functionsPath, baseFilename]
    }

    const dummyPath = filenameArr.join('|')

    sources.push([dummyPath, content])
  })

  const textualSource = sources
    .sort(([filenameA], [filenameB]) => filenameA[0].localeCompare(filenameB[0]))
    .map(([filename, content]) => `${filename}: ${content}`)
    .join('/-----------------/')

  t.snapshot(normalize(JSON.stringify(textualSource)))
})
