const dotProp = require('dot-prop')
const { print } = require('graphql')

const { munge } = require('./codegen-helpers')

const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1)

const unnamedSymbols = new Set(['query', 'mutation', 'subscription'])

const isOperationNamed = (operationData) => !unnamedSymbols.has(operationData.name.trim())

const addLeftWhitespace = (string, padding) => {
    const paddingString = ' '.repeat(padding)

    return string
        .split('\n')
        .map((line) => paddingString + line)
        .join('\n')
}

const collapseExtraNewlines = (string) => string.replace(/\n{2,}/g, '\n\n')

const snippetOptions = [
    {
        id: 'postHttpMethod',
        label: 'POST function',
        initial: true,
    },
    {
        id: 'useClientAuth',
        label: "Use user's OAuth token",
        initial: false,
    },
]

const operationFunctionName = (operationData) => {
    const { type } = operationData

    let prefix = 'unknow'
    switch (type) {
        case 'query':
            prefix = 'fetch'
            break
        case 'mutation':
            prefix = 'execute'
            break
        case 'subscription':
            prefix = 'subscribeTo'
            break
        default:
            break
    }

    const fnName = prefix + (prefix.length === 0 ? operationData.name : capitalizeFirstLetter(operationData.name))

    return fnName
}

const coercerFor = (type, name) => {
    const typeName = print(type).replace(/\W+/gi, '').toLocaleLowerCase()

    switch (typeName) {
        case 'string':
            return `${name}`
        case 'int':
            return `parseInt(${name})`
        case 'float':
            return `parseFloat(${name})`
        case 'boolean':
            return `${name} === 'true'`
        default:
            return `${name}`
    }
}

const asyncFetcherInvocation = (operationDataList, pluckerStyle) => {
    const invocations = operationDataList
        .filter((operationData) => ['query', 'mutation', 'subscription'].includes(operationData.type))
        .map((namedOperationData) => {
            const params = (namedOperationData.operationDefinition.variableDefinitions || []).map(
                (def) => def.variable.name.value,
            )

            const invocationParams = params.map((param) => `${param}: ${munge(param)}`)

            const pluckers = {
                get:
                    dotProp
                        .get(namedOperationData, 'operationDefinition.variableDefinitions', [])
                        .map((def) => {
                            const name = def.variable.name.value
                            const withCoercer = coercerFor(def.type, `event.queryStringParameters?.${name}`)
                            return `const ${munge(name)} = ${withCoercer};`
                        })
                        .join('\n  ') || '',
                post:
                    dotProp
                        .get(namedOperationData, 'operationDefinition.variableDefinitions', [])
                        .map((def) => {
                            const name = def.variable.name.value
                            return `const ${munge(name)} = eventBodyJson?.${name};`
                        })
                        .join('\n  ') || '',
            }

            let variableValidation = ''

            let requiredVariableCount = 0

            if ((dotProp.get(namedOperationData, 'operationDefinition.variableDefinitions', []).length !== 0 || 0) > 0) {
                const requiredVariableNames = namedOperationData.operationDefinition.variableDefinitions
                    .map((def) => (print(def.type).endsWith('!') ? def.variable.name.value : null))
                    .filter(Boolean)

                requiredVariableCount = requiredVariableNames.length

                // TODO: Filter nullable variables
                const condition = requiredVariableNames
                    .map((name) => `${munge(name)} === undefined || ${munge(name)} === null`)
                    .join(' || ')

                const message = requiredVariableNames.map((name) => `\`${name}\``).join(', ')

                variableValidation = `  if (${condition}) {
    return res.status(422).json({
      error: 'You must supply parameters for: ${message}'
    }),
  }`
            }

            return `${pluckerStyle === 'get' ? pluckers.get : pluckers.post}

${requiredVariableCount > 0 ? variableValidation : ''}

  const { errors: ${namedOperationData.name}Errors, data: ${namedOperationData.name}Data } =
    await Netligraph.${operationFunctionName(namedOperationData)}({ ${invocationParams.join(', ')} }, accessToken);

  if (${namedOperationData.name}Errors) {
    console.error(JSON.stringify(${namedOperationData.name}Errors, null, 2));
  }

  console.log(JSON.stringify(${namedOperationData.name}Data, null, 2));`
        })
        .join('\n\n')

    return invocations
}

const clientSideInvocations = (operationDataList, pluckerStyle, useClientAuth) => {
    const invocations = operationDataList
        .filter((operationData) => ['query', 'mutation', 'subscription'].includes(operationData.type))
        .map((namedOperationData) => {
            const whitespace = 8

            const params = (namedOperationData.operationDefinition.variableDefinitions || []).map(
                (def) => def.variable.name.value,
            )
            let bodyPayload = ''

            if ((dotProp.get(namedOperationData, 'operationDefinition.variableDefinitions', []).length !== 0 || 0) > 0) {
                const variableNames = namedOperationData.operationDefinition.variableDefinitions.map(
                    (def) => def.variable.name.value,
                )

                const variables = variableNames.map((name) => `"${name}": ${name}`).join(',\n')

                bodyPayload = `
${variables}
`
            }

            const clientAuth = useClientAuth
                ? `,
      headers: {
        ...oneGraphAuth?.authHeaders()
      }`
                : ''

            return `async function ${operationFunctionName(namedOperationData)}(${useClientAuth ? 'oneGraphAuth, ' : ''
                }params) {
  const {${params.join(', ')}} = params || {};
  const resp = await fetch(\`/api/${namedOperationData.name}${pluckerStyle === 'get' ? `?${params.map((param) => `${param}=\${${param}}`).join('&')}` : ''
                }\`,
    {
      method: "${pluckerStyle.toLocaleUpperCase()}"${pluckerStyle === 'get'
                    ? ''
                    : `,
      body: JSON.stringify({${addLeftWhitespace(bodyPayload, whitespace).trim()}})${clientAuth}`
                }
    });

    const text = await resp.text();

    return JSON.parse(text);
}`
        })
        .join('\n\n')

    return invocations
}

const subscriptionHandler = ({ netligraphConfig, operationData }) => `${imp(
    netligraphConfig,
    '{ getSecrets }',
    '@sgrove/netlify-functions',
)}
${imp(netligraphConfig, 'NetlifyGraph', netligraphConfig.netligraphRequirePath)}

${exp(netligraphConfig, 'handler')} = async (req, res) => {
  let secrets = await getSecrets(event);

  const payload = NetlifyGraph.parseAndVerify${operationData.name}Event(event);

  if (!payload) {
    return res.status(412).json({
      success: false,
      error: 'Unable to verify payload signature',
    })
  }

  const { errors: ${operationData.name}Errors, data: ${operationData.name}Data } = payload;

  if (${operationData.name}Errors) {
    console.error(${operationData.name}Errors);
  }

  console.log(${operationData.name}Data);

  /**
   * If you want to unsubscribe from this webhook
   * in order to stop receiving new events,
   * simply return status 410, e.g.:
   *
   * return res.status(410).json(null);
   */

  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({successfullyProcessedIncomingWebhook: true})
};
`

const imp = (netligraphConfig, name, package) => {
    if (netligraphConfig.moduleType === 'commonjs') {
        return `const ${name} = require("${package}")`
    }

    return `import ${name} from "${package}"`
}

const exp = (netligraphConfig, name) => {
    if (netligraphConfig.moduleType === 'commonjs') {
        return `exports.${name}`
    }

    return `export const ${name}`
}

// Snippet generation!
const nextjsFunctionSnippet = {
    language: 'JavaScript',
    codeMirrorMode: 'javascript',
    name: 'Netlify Function',
    options: snippetOptions,
    generate: (opts) => {
        const { netligraphConfig, options } = opts

        const operationDataList = opts.operationDataList.map((operationData, idx) => {
            if (!isOperationNamed(operationData)) {
                return {
                    ...operationData,
                    name: `unnamed${capitalizeFirstLetter(operationData.type)}${idx + 1}`.trim(),
                    query: `# Consider giving this ${operationData.type} a unique, descriptive
# name in your application as a best practice
${operationData.type} unnamed${capitalizeFirstLetter(operationData.type)}${idx + 1} ${operationData.query
                            .trim()
                            .replace(/^(query|mutation|subscription) /i, '')}`,
                }
            }
            return operationData
        })

        const firstOperation = operationDataList.find(
            (operation) => operation.operationDefinition.kind === 'OperationDefinition',
        )

        if (!firstOperation) {
            return '// No operation found'
        }

        const filename = `${firstOperation.name}.${netligraphConfig.extension}`

        const isSubscription = firstOperation.type === 'subscription'

        if (isSubscription) {
            const result = subscriptionHandler({
                netligraphConfig,
                operationData: firstOperation,
            })

            return result
        }

        const fetcherInvocation = asyncFetcherInvocation(
            operationDataList,
            dotProp.get(options, 'postHttpMethod') === true ? 'post' : 'get',
        )

        const passThroughResults = operationDataList
            .filter((operationData) => ['query', 'mutation', 'subscription'].includes(operationData.type))
            .map(
                (operationData) => `${operationData.name}Errors: ${operationData.name}Errors,
${operationData.name}Data: ${operationData.name}Data`,
            )
            .join(',\n')

        const clientSideCalls = clientSideInvocations(
            operationDataList,
            dotProp.get(options, 'postHttpMethod') === true ? 'post' : 'get',
            options.useClientAuth,
        )

        const whitespace = 6

        const snippet = `${imp(netligraphConfig, '{ getSecrets }', '@sgrove/netlify-functions')};
${imp(netligraphConfig, 'Netligraph', netligraphConfig.netligraphRequirePath)}

${exp(netligraphConfig, 'handler')} = async (req, res) => {
  // By default, all API calls use no authentication
  let accessToken = null;

  //// If you want to use the client's accessToken when making API calls on the user's behalf:
  // accessToken = event.headers["authorization"]?.split(" ")[1]

  //// If you want to use the API with your own access token:
  // accessToken = (await getSecrets(event))?.oneGraph?.bearerToken;
      
  const eventBodyJson = JSON.parse(req.body || "{}");

  ${fetcherInvocation}

  res.setHeader('Content-Type', 'application/json');

  return res.status(200).json({
    success: true,
${addLeftWhitespace(passThroughResults, whitespace)}
    })
};

/** 
 * Client-side invocations:
 * Call your Netlify function from the browser (after saving
 * the code to \`${filename}\`) with these helpers:
 */

/**
${clientSideCalls}
*/

export default handler;`

        return collapseExtraNewlines(snippet)
    },
}

module.exports = { nextjsFunctionSnippet }
