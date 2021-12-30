const fs = require('fs')
const process = require('process')

const { Kind, parse, print } = require('graphql')
const _ = require('lodash')

const {
  patchSubscriptionWebhookField,
  patchSubscriptionWebhookSecretField,
  typeScriptSignatureForOperation,
  typeScriptSignatureForOperationVariables,
} = require('./graphql-helpers')
const { computeOperationDataList, netlifyFunctionSnippet } = require('./netligraph-code-exporter-snippets')

const netligraphPath = `${process.cwd()}/netlify`

const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1)

const replaceAll = (target, search, replace) => {
  const simpleString = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return target.replace(new RegExp(simpleString, 'g'), replace)
}

const generatedOneGraphClient = `
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

export async function fetchOneGraphPersisted(
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

export async function fetchOneGraph(
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
export function ${subscriptionFunctionName(fn)} (
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
    throw new Error(`Operation definition is required in ${basicFn.id}`)
  }

  const [operation] = operations

  const returnSignature = typeScriptSignatureForOperation(fullSchema, operation, fragments)

  const variableNames = (operation.variableDefinitions || []).map((varDef) => varDef.variable.name.value)

  const variableSignature = typeScriptSignatureForOperationVariables(variableNames, fullSchema, operation)

  const operationName = operation.name && operation.name.value

  if (!operationName) {
    throw new Error(`Operation name is required in ${basicFn.definition}\n\tfound: ${JSON.stringify(operation.name)}`)
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

const generateJavaScriptClient = (schema, operationsDoc, enabledFunctions) => {
  const operationsWithoutTemplateDollar = replaceAll(operationsDoc, '${', '\\${')
  const safeOperationsDoc = replaceAll(operationsWithoutTemplateDollar, '`', '\\`')
  const functionDecls = enabledFunctions.map((fn) => {
    if (fn.kind === 'subscription') {
      const fragments = []
      return generateSubscriptionFunction(schema, fn, fragments)
    }

    const dynamicFunction = `const ${fn.fnName} = (
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

    const staticFunction = `const ${fn.fnName} = (
  variables,
  accessToken,
) => {
  // return fetchOneGraphPersisted(accessToken, "${fn.id}", "${fn.operationName}", variables)
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
  ${fn.fnName}: ${fn.fnName}`
    })
    .join(',\n  ')

  const source = `// GENERATED VIA \`netlify-plugin-netligraph\`, EDIT WITH CAUTION!
import https from 'https'
import crypto from 'crypto'

export const verifySignature = (input) => {
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

${generatedOneGraphClient}

export const verifyRequestSignature = (request) => {
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

export default functions
  `

  // const formatted = Prettier.format(source, {
  //     tabWidth: 2,
  //     semi: false,
  //     singleQuote: true,
  //     parser: 'babel-ts',
  // })

  return source
}

const generateTypeScriptDefinitions = (schema, enabledFunctions) => {
  const functionDecls = enabledFunctions.map((fn) => {
    const isSubscription = fn.kind === 'subscription'

    if (isSubscription) {
      const fragments = []
      return generateSubscriptionFunctionTypeDefinition(schema, fn, fragments)
    }

    if (isSubscription) {
      const subscriptionFnName = subscriptionFunctionName(fn)
      const parserFnName = subscriptionParserName(fn)

      const jsDoc = replaceAll(fn.description || '', '*/', '')
        .split('\n')
        .join('\n* ')

      return `/**
 * ${jsDoc}
 */
  ${subscriptionFnName}: ${subscriptionFnName},
  /**
   * Verify the event body is signed securely, and then parse the result.
   */
  ${parserFnName}: ${parserFnName}`
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

  const source = `// GENERATED VIA \`netlify-plugin-netligraph\`, EDIT WITH CAUTION!
${functionDecls.join('\n\n')}
`

  return source
}

const generateFunctionsFile = (basePath, schema, operationsDoc, queries) => {
  const functionDefinitions = queries.map((query) => queryToFunctionDefinition(schema, query))
  const clientSource = generateJavaScriptClient(schema, operationsDoc, functionDefinitions)
  const typeDefinitionsSource = generateTypeScriptDefinitions(schema, functionDefinitions)

  fs.writeFileSync(`${basePath}/netligraphFunctions.mjs`, clientSource, 'utf8')
  fs.writeFileSync(`${basePath}/netligraphFunctions.d.ts`, typeDefinitionsSource, 'utf8')
}

const extractFunctionsFromOperationDoc = (parsedDoc) => {
  const fns = parsedDoc.definitions
    .map((next) => {
      if (next.kind !== 'OperationDefinition') {
        return null
      }

      const key = _.get(next, ['name', 'value'])

      const directive = _.get(next, ['directives'], []).find(
        (localDirective) => localDirective.name.value === 'netligraph',
      )
      const docArg = _.get(directive, ['arguments']).find((arg) => arg.name.value === 'doc')

      let docString = _.get(docArg, ['value', 'value'])

      if (!key) {
        return null
      }

      if (!docString) {
        docString = ''
      }

      const operation = {
        id: key,
        description: docString,
        operation: next.operation,
        query: print(next),
      }

      return operation
    })
    .filter(Boolean)

  return fns
}

const sourceOperationsFilename = 'netligraphOperationsLibrary.graphql'

const readGraphQLOperationsSourceFile = (basePath) => {
  const fullFilename = `${basePath}/${sourceOperationsFilename}`
  if (!fs.existsSync(fullFilename)) {
    fs.closeSync(fs.openSync(fullFilename, 'w'))
  }
  const source = fs.readFileSync(fullFilename, 'utf8')

  return source
}

const readAndParseGraphQLOperationsSourceFile = (basePath) => {
  const source = readGraphQLOperationsSourceFile(basePath)

  try {
    const parsedGraphQLDoc = parse(source, {
      noLocation: true,
    })

    return [parsedGraphQLDoc]
  } catch (error) {
    return []
  }
}

const writeGraphQLOperationsSourceFile = (basePath, operationDocString) => {
  const graphqlSource = operationDocString

  fs.writeFileSync(`${basePath}/${sourceOperationsFilename}`, graphqlSource, 'utf8')
}

const generateHandler = (basePath, schema, operationId, handlerOptions) => {
  const [doc] = readAndParseGraphQLOperationsSourceFile(basePath)
  const operation = doc.definitions.find((op) => op.kind === Kind.OPERATION_DEFINITION && op.name.value === operationId)

  if (!operation) {
    console.warn(`Operation ${operationId} not found in graphql.`)
  }

  const odl = computeOperationDataList({ query: print(operation), variables: [] })

  const source = netlifyFunctionSnippet.generate({
    operationDataList: odl.operationDataList,
    schema,
    options: handlerOptions,
  })

  const newFunction = {
    functionName: operationId,
  }

  const filename = `netlify/functions/${newFunction.functionName}.js`

  fs.writeFileSync(filename, source)
}

module.exports = {
  extractFunctionsFromOperationDoc,
  generateFunctionsFile,
  generateHandler,
  netligraphPath,
  readGraphQLOperationsSourceFile,
  readAndParseGraphQLOperationsSourceFile,
  writeGraphQLOperationsSourceFile,
}
