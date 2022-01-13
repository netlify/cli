const fs = require('fs')
const { join } = require('path')

const test = require('ava')
const { buildSchema, parse } = require('graphql')

const {
  extractFunctionsFromOperationDoc,
  generateFunctionsSource,
  generateHandlerSource,
} = require('../src/lib/one-graph/netlify-graph')

const { normalize } = require('./utils/snapshots')

const netligraphConfig = {
  extension: 'js',
  netligraphPath: 'netlify',
  moduleType: 'commonjs',
  functionsPath: 'functions',
  netligraphImplementationFilename: 'dummy/index.js',
  netligraphTypeDefinitionsFilename: 'dummy/index.d.ts',
  graphQLOperationsSourceFilename: 'dummy/netligraphOperationsLibrary.graphql',
  graphQLSchemaFilename: 'dummy/netligraphSchema.graphql',
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
  const generatedFunctions = generateFunctionsSource(netligraphConfig, schema, appOperationsDoc, operations)

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
    netligraphConfig,
    schema,
    operationsDoc: appOperationsDoc,
    operationId,
    handlerOptions,
  })

  t.snapshot(normalize(JSON.stringify(generatedHandler)))
})
