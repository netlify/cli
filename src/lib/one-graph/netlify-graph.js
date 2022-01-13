const { randomUUID } = require('crypto')
const fs = require('fs')

const dotProp = require('dot-prop')
const { parse, print, printSchema } = require('graphql')

const { detectServerSettings, error, getFunctionsDir, warn } = require('../../utils')

const {
  patchSubscriptionWebhookField,
  patchSubscriptionWebhookSecretField,
  typeScriptSignatureForOperation,
  typeScriptSignatureForOperationVariables,
} = require('./graphql-helpers')
const { computeOperationDataList, netlifyFunctionSnippet } = require('./netlify-graph-code-exporter-snippets')

const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1)

const replaceAll = (target, search, replace) => {
  const simpleString = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return target.replace(new RegExp(simpleString, 'g'), replace)
}

const sourceOperationsFilename = 'netligraphOperationsLibrary.graphql'

const defaultNetligraphConfig = {
  extension: 'js',
  netligraphPath: 'netlify',
  moduleType: 'commonjs',
}

/**
 * Return a full Netligraph config with any defaults overridden by netlify.toml
 * @param {import('../base-command').BaseCommand} command
 */
const getNetligraphConfig = async ({ command, options }) => {
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
  const functionsPath = isNextjs ? 'pages/api' : getFunctionsDir({ config, options }) || `functions`
  const netligraphPath = isNextjs ? 'lib/netligraph' : `${functionsPath}/netligraph`
  const baseConfig = { ...defaultNetligraphConfig, ...userSpecifiedConfig, netligraphPath }
  const netligraphImplementationFilename = `${baseConfig.netligraphPath}/index.${baseConfig.extension}`
  const netligraphTypeDefinitionsFilename = `${baseConfig.netligraphPath}/index.d.ts`
  const graphQLOperationsSourceFilename = `${baseConfig.netligraphPath}/${sourceOperationsFilename}`
  const graphQLSchemaFilename = 'netligraphSchema.graphql'
  const netligraphRequirePath = isNextjs ? '../../lib/netligraph' : `./netligraph`
  const fullConfig = {
    ...baseConfig,
    functionsPath,
    netligraphImplementationFilename,
    netligraphTypeDefinitionsFilename,
    graphQLOperationsSourceFilename,
    graphQLSchemaFilename,
    netligraphRequirePath,
    framework,
  }

  return fullConfig
}

const ensureNetligraphPath = (netligraphConfig) => {
  fs.mkdirSync(netligraphConfig.netligraphPath, { recursive: true })
}

const ensureFunctionsPath = (netligraphConfig) => {
  fs.mkdirSync(netligraphConfig.functionsPath, { recursive: true })
}

const defaultExampleOperationsDoc = `query ExampleQuery @netligraph(doc: "An example query to start with.") {
  __typename
}`

const generatedOneGraphClient = () =>
  `
const fetch = (appId, options) => {
  var reqBody = options.body || null
  const userHeaders = options.headers || {}
  const headers = {
    ...userHeaders,
    'Content-Type': 'application/json',
    'Content-Length': reqBody.length,
  }

  var reqOptions = {
    method: 'POST',
    headers: headers,
    timeout: 30000,
  }

  const url = 'https://serve.onegraph.com/graphql?app_id=' + appId

  const respBody = []

  return new Promise((resolve, reject) => {
    var req = https.request(url, reqOptions, (res) => {
      if (res.statusCode < 200 || res.statusCode > 299) {
        return reject(
          new Error(
            "Netlify OneGraph return non - OK HTTP status code" + res.statusCode,
          ),
        )
      }

      res.on('data', (chunk) => respBody.push(chunk))

      res.on('end', () => {
        const resString = Buffer.concat(respBody).toString()
        resolve(resString)
      })
    })

    req.on('error', (e) => {
      console.error('Error making request to Netlify OneGraph: ', e)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request to Netlify OneGraph timed out'))
    })

    req.write(reqBody)
    req.end()
  })
}

const fetchOneGraphPersisted = async function fetchOneGraphPersisted(
  accessToken,
  docId,
  operationName,
  variables,
) {
  const payload = {
    doc_id: docId,
    variables: variables,
    operationName: operationName,
  }

  const result = await fetch(
    process.env.SITE_ID,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? "Bearer " + accessToken : '',
      },
      body: JSON.stringify(payload),
    },
  )

  // @ts-ignore
  return JSON.parse(result)
}

const fetchOneGraph = async function fetchOneGraph(
  accessToken,
  query,
  operationName,
  variables,
) {
  const payload = {
    query: query,
    variables: variables,
    operationName: operationName,
  }

  const result = await fetch(
    process.env.SITE_ID,
    {
      method: 'POST',
      headers: {
        Authorization: accessToken ? "Bearer " + accessToken : '',
      },
      body: JSON.stringify(payload),
    },
  )

  // @ts-ignore
  return JSON.parse(result)
}
`

const subscriptionParserName = (fn) => `parseAndVerify${fn.operationName}Event`

const subscriptionFunctionName = (fn) => `subscribeTo${fn.operationName}`

const exp = (netligraphConfig, name) => {
  if (netligraphConfig.moduleType === 'commonjs') {
    return `exports.${name}`
  }

  return `export const ${name}`
}

const imp = (netligraphConfig, name, package) => {
  if (netligraphConfig.moduleType === 'commonjs') {
    return `const ${name} = require("${package}")`
  }

  return `import ${name} from "${package}"`
}

const generateSubscriptionFunctionTypeDefinition = (schema, fn, fragments) => {
  const parsingFunctionReturnSignature = typeScriptSignatureForOperation(schema, fn.parsedOperation, fragments)

  const variableNames = (fn.parsedOperation.variableDefinitions || []).map((varDef) => varDef.variable.name.value)

  const variableSignature = typeScriptSignatureForOperationVariables(variableNames, schema, fn.parsedOperation)

  const jsDoc = replaceAll(fn.description || '', '*/', '!')
    .split('\n')
    .join('\n* ')

  return `/**
* ${jsDoc}
*/
export function ${subscriptionFunctionName(fn)}(
  /**
   * This will be available in your webhook handler as a query parameter.
   * Use this to keep track of which subscription you're receiving
   * events for.
   */
  netligraphWebhookId: string,
  variables: ${variableSignature},
  accessToken?: string | null
  ) : void

/**
 * Verify the ${fn.operationName} event body is signed securely, and then parse the result.
 */
export function ${subscriptionParserName(
    fn,
  )} (/** A Netlify Handler Event */ event) : null | ${parsingFunctionReturnSignature}
`
}

// TODO: Handle fragments
const generateSubscriptionFunction = (schema, fn) => {
  const patchedWithWebhookUrl = patchSubscriptionWebhookField({
    schema,
    definition: fn.parsedOperation,
  })

  const patched = patchSubscriptionWebhookSecretField({
    schema,
    definition: patchedWithWebhookUrl,
  })

  // TODO: Don't allow unnamed operations as subscription
  const filename = (patched.name && patched.name.value) || 'Unknown'

  const body = print(patched)
  const safeBody = replaceAll(body, '${', '\\${')

  return `const ${subscriptionFunctionName(fn)} = async (
  /**
   * This will be available in your webhook handler as a query parameter.
   * Use this to keep track of which subscription you're receiving
   * events for.
   */
  netligraphWebhookId,
  variables,
  accessToken,
  ) => {
    const netligraphWebhookUrl = \`\${process.env.DEPLOY_URL}/.netlify/functions/${filename}?netligraphWebhookId=\${netligraphWebhookId}\`
    const secret = process.env.NETLIGRAPH_WEBHOOK_SECRET
    const fullVariables = {...variables, netligraphWebhookUrl: netligraphWebhookUrl, netligraphWebhookSecret: { hmacSha256Key: secret }}

    const persistedInput = {
      doc_id: "${fn.id}",
      oeprationName: "${fn.operationName}",
      variables: fullVariables,
      accessToken: accessToken
    }

    const subscriptionOperationDoc = \`${safeBody}\`;

    // const result = await fetchOneGraphPersisted(persistedInput)
    const result = await fetchOneGraph(accessToken, subscriptionOperationDoc, "${fn.operationName}", fullVariables)
}

const ${subscriptionParserName(fn)} = (event) => {
  if (!verifyRequestSignature({ event: event })) {
    console.warn("Unable to verify signature for ${filename}")
    return null
  }
  
  return JSON.parse(event.body || '{}')
}`
}

const makeFunctionName = (kind, operationName) => {
  if (kind === 'query') {
    return `fetch${capitalizeFirstLetter(operationName)}`
  }
  if (kind === 'mutation') {
    return `execute${capitalizeFirstLetter(operationName)} `
  }

  return capitalizeFirstLetter(operationName)
}

const queryToFunctionDefinition = (fullSchema, persistedQuery) => {
  const basicFn = {
    id: persistedQuery.id,
    definition: persistedQuery.query,
    description: persistedQuery.description,
  }

  const body = basicFn.definition
  const safeBody = replaceAll(body, '${', '\\${')

  const parsed = parse(body)
  const operations = parsed.definitions.filter((def) => def.kind === 'OperationDefinition')
  const fragments = parsed.definitions.filter((def) => def.kind === 'FragmentDefinition')

  if (!operations) {
    error(`Operation definition is required in ${basicFn.id}`)
    return
  }

  const [operation] = operations

  const returnSignature = typeScriptSignatureForOperation(fullSchema, operation, fragments)

  const variableNames = (operation.variableDefinitions || []).map((varDef) => varDef.variable.name.value)

  const variableSignature = typeScriptSignatureForOperationVariables(variableNames, fullSchema, operation)

  const operationName = operation.name && operation.name.value

  if (!operationName) {
    error(`Operation name is required in ${basicFn.definition}\n\tfound: ${JSON.stringify(operation.name)}`)
    return
  }

  const fn = {
    ...basicFn,
    fnName: makeFunctionName(operation.operation, operationName),
    safeBody,
    kind: operation.operation,
    variableSignature,
    returnSignature,
    operationName,
    parsedOperation: operation,
  }

  return fn
}

const generateJavaScriptClient = (netligraphConfig, schema, operationsDoc, enabledFunctions) => {
  const operationsWithoutTemplateDollar = replaceAll(operationsDoc, '${', '\\${')
  const safeOperationsDoc = replaceAll(operationsWithoutTemplateDollar, '`', '\\`')
  const functionDecls = enabledFunctions.map((fn) => {
    if (fn.kind === 'subscription') {
      const fragments = []
      return generateSubscriptionFunction(schema, fn, fragments)
    }

    const dynamicFunction = `${exp(netligraphConfig, fn.fnName)} = (
  variables,
  accessToken,
  ) => {
  return fetchOneGraph({
    query: \`${fn.safeBody}\`,
    variables: variables,
    accessToken: accessToken
  })
}

  `

    const staticFunction = `${exp(netligraphConfig, fn.fnName)} = (
  variables,
  accessToken,
) => {
  return fetchOneGraph(accessToken, operationsDoc, "${fn.operationName}", variables)
}

`
    return fn.id ? staticFunction : dynamicFunction
  })

  const exportedFunctionsObjectProperties = enabledFunctions
    .map((fn) => {
      const isSubscription = fn.kind === 'subscription'

      if (isSubscription) {
        const subscriptionFnName = subscriptionFunctionName(fn)
        const parserFnName = subscriptionParserName(fn)

        const jsDoc = replaceAll(fn.description || '', '*/', '')
          .split('\n')
          .join('\n* ')

        return `/**
  * ${jsDoc}
  */
  ${subscriptionFnName}:${subscriptionFnName},
  /**
   * Verify the event body is signed securely, and then parse the result.
   */
  ${parserFnName}: ${parserFnName}`
      }

      const jsDoc = replaceAll(fn.description || '', '*/', '')
        .split('\n')
        .join('\n* ')

      return `/**
  * ${jsDoc}
  */
  ${fn.fnName}: ${netligraphConfig.moduleType === 'commonjs' ? 'exports.' : ''}${fn.fnName}`
    })
    .join(',\n  ')

  const dummyHandler = `${exp(netligraphConfig, 'handler')} = async (event, context) => {
  // return a 401 json response
  return {
    statusCode: 401,
    body: JSON.stringify({
      message: 'Unauthorized',
    }),
  }
}`

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
${imp(netligraphConfig, 'https', 'https')}
${imp(netligraphConfig, 'crypto', 'crypto')}

${exp(netligraphConfig, 'verifySignature')} = (input) => {
  const secret = input.secret
  const body = input.body
  const signature = input.signature

  if (!signature) {
    console.error('Missing signature')
    return false
  }

  const sig = {}
  for (const pair of signature.split(',')) {
    const [k, v] = pair.split('=')
    sig[k] = v
  }

  if (!sig.t || !sig.hmac_sha256) {
    console.error('Invalid signature header')
    return false
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(sig.t)
    .update('.')
    .update(body)
    .digest('hex')

  if (
    !crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(sig.hmac_sha256, 'hex')
    )
  ) {
    console.error('Invalid signature')
    return false
  }

  if (parseInt(sig.t, 10) < Date.now() / 1000 - 300 /* 5 minutes */) {
    console.error('Request is too old')
    return false
  }

  return true
}

const operationsDoc = \`${safeOperationsDoc}\`

${generatedOneGraphClient()}

${exp(netligraphConfig, 'verifyRequestSignature')} = (request) => {
  const event = request.event
  const secret = process.env.NETLIGRAPH_WEBHOOK_SECRET
  const signature = event.headers['x-onegraph-signature']
  const body = event.body

  if (!secret) {
    console.error(
      'NETLIGRAPH_WEBHOOK_SECRET is not set, cannot verify incoming webhook request'
    )
    return false
  }

  return verifySignature({ secret, signature, body: body || '' })
}

${functionDecls.join('\n\n')}
  
/**
 * The generated Netligraph library with your operations
 */
const functions = {
  ${exportedFunctionsObjectProperties}
}

${netligraphConfig.moduleType === 'commonjs' ? 'exports.default = functions' : 'export default functions'}

${dummyHandler}`

  return source
}

const generateTypeScriptDefinitions = (netligraphConfig, schema, enabledFunctions) => {
  const functionDecls = enabledFunctions.map((fn) => {
    const isSubscription = fn.kind === 'subscription'

    if (isSubscription) {
      const fragments = []
      return generateSubscriptionFunctionTypeDefinition(schema, fn, fragments)
    }

    const jsDoc = replaceAll(fn.description || ``, '*/', '')
      .split('\n')
      .join('\n* ')

    return `/**
 * ${jsDoc}
 */
export function ${fn.fnName}(
  variables: ${fn.variableSignature},
  accessToken?: string
): Promise<
  ${fn.returnSignature}
>;`
  })

  const source = `// GENERATED VIA NETLIFY AUTOMATED DEV TOOLS, EDIT WITH CAUTION!
${functionDecls.join('\n\n')}
`

  return source
}

const generateFunctionsSource = (netligraphConfig, schema, operationsDoc, queries) => {
  const functionDefinitions = Object.values(queries).map((query) => queryToFunctionDefinition(schema, query))
  const clientSource = generateJavaScriptClient(netligraphConfig, schema, operationsDoc, functionDefinitions)
  const typeDefinitionsSource = generateTypeScriptDefinitions(netligraphConfig, schema, functionDefinitions)

  return {
    clientSource,
    typeDefinitionsSource,
    functionDefinitions,
  }
}

const generateFunctionsFile = (netligraphConfig, schema, operationsDoc, queries) => {
  const { clientSource, typeDefinitionsSource } = generateFunctionsSource(
    netligraphConfig,
    schema,
    operationsDoc,
    queries,
  )

  ensureNetligraphPath(netligraphConfig)
  fs.writeFileSync(netligraphConfig.netligraphImplementationFilename, clientSource, 'utf8')
  fs.writeFileSync(netligraphConfig.netligraphTypeDefinitionsFilename, typeDefinitionsSource, 'utf8')
}

const pluckDirectiveArgValue = (directive, argName) => {
  const targetArg = dotProp.get(directive, 'arguments', []).find((arg) => arg.name.value === argName)
  if (!(targetArg && targetArg.value)) {
    return null
  }

  if (targetArg.value.kind === 'StringValue') {
    return targetArg.value.value
  }

  return null
}

const extractFunctionsFromOperationDoc = (parsedDoc) => {
  const functionEntries = parsedDoc.definitions
    .map((next) => {
      if (next.kind !== 'OperationDefinition') {
        return null
      }

      const key = dotProp.get(next, 'name.value')

      const directive = dotProp
        .get(next, 'directives', [])
        .find((localDirective) => localDirective.name.value === 'netligraph')

      if (!directive) {
        return null
      }

      const docString = pluckDirectiveArgValue(directive, 'doc') || ''
      let id = pluckDirectiveArgValue(directive, 'id')

      if (!id) {
        id = randomUUID()
      }

      const operation = {
        id,
        name: key,
        description: docString,
        operation: next.operation,
        query: print(next),
      }

      return [id, operation]
    })
    .filter(Boolean)

  return Object.fromEntries(functionEntries)
}

const readGraphQLOperationsSourceFile = (netligraphConfig) => {
  ensureNetligraphPath(netligraphConfig)

  const fullFilename = netligraphConfig.graphQLOperationsSourceFilename
  if (!fs.existsSync(fullFilename)) {
    fs.writeFileSync(fullFilename, '')
    fs.closeSync(fs.openSync(fullFilename, 'w'))
  }
  const source = fs.readFileSync(fullFilename, 'utf8')

  return source
}

const writeGraphQLOperationsSourceFile = (netligraphConfig, operationDocString) => {
  const graphqlSource = operationDocString

  ensureNetligraphPath(netligraphConfig)
  fs.writeFileSync(netligraphConfig.graphQLOperationsSourceFilename, graphqlSource, 'utf8')
}

const writeGraphQLSchemaFile = (netligraphConfig, schema) => {
  const graphqlSource = printSchema(schema)

  ensureNetligraphPath(netligraphConfig)
  fs.writeFileSync(
    `${netligraphConfig.netligraphPath}/${netligraphConfig.graphQLSchemaFilename}`,
    graphqlSource,
    'utf8',
  )
}

const readGraphQLSchemaFile = (netligraphConfig) => {
  ensureNetligraphPath(netligraphConfig)
  return fs.readFileSync(`${netligraphConfig.netligraphPath}/${netligraphConfig.graphQLSchemaFilename}`, 'utf8')
}

const generateHandlerSource = ({ handlerOptions, netligraphConfig, operationId, operationsDoc, schema }) => {
  const parsedDoc = parse(operationsDoc)
  const operations = extractFunctionsFromOperationDoc(parsedDoc)
  const operation = operations[operationId]

  if (!operation) {
    warn(`Operation ${operationId} not found in graphql.`, Object.keys(operations))
    return
  }

  const odl = computeOperationDataList({ query: operation.query, variables: [] })

  const source = netlifyFunctionSnippet.generate({
    netligraphConfig,
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  })

  return { source, operation }
}

const generateHandler = (netligraphConfig, schema, operationId, handlerOptions) => {
  let currentOperationsDoc = readGraphQLOperationsSourceFile(netligraphConfig)
  if (currentOperationsDoc.trim().length === 0) {
    currentOperationsDoc = defaultExampleOperationsDoc
  }

  const handlerSource = generateHandlerSource({
    netligraphConfig,
    schema,
    operationsDoc: currentOperationsDoc,
    operationId,
    handlerOptions,
  })

  if (!(handlerSource && handlerSource.source)) {
    return
  }

  const { operation, source } = handlerSource

  const filename = `${netligraphConfig.functionsPath}/${operation.name}.${netligraphConfig.extension}`

  ensureFunctionsPath(netligraphConfig)
  fs.writeFileSync(filename, source)
}

module.exports = {
  defaultExampleOperationsDoc,
  extractFunctionsFromOperationDoc,
  generateFunctionsSource,
  generateFunctionsFile,
  generateHandler,
  generateHandlerSource,
  getNetligraphConfig,
  readGraphQLOperationsSourceFile,
  readGraphQLSchemaFile,
  writeGraphQLOperationsSourceFile,
  writeGraphQLSchemaFile,
}
