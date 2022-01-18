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
  functionsPath: 'functions',
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
  const generatedHandler = generateHandlerSource({
    netlifyGraphConfig,
    schema,
    operationsDoc: appOperationsDoc,
    operationId,
    handlerOptions,
  })

  t.snapshot(normalize(JSON.stringify(generatedHandler)))
})
