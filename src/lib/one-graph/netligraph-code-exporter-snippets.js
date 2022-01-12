const dotProp = require('dot-prop')
const { parse, print } = require('graphql')

const { munge } = require('./codegen-helpers')

let operationNodesMemo = [null, null]

const getOperationNodes = (query) => {
  if (operationNodesMemo[0] === query && operationNodesMemo[1]) {
    return operationNodesMemo[1]
  }
  const operationDefinitions = []
  try {
    parse(query).definitions.forEach((def) => {
      if (def.kind === 'FragmentDefinition' || def.kind === 'OperationDefinition') {
        operationDefinitions.push(def)
      }
    })
  } catch (error) {
    // ignore
  }
  operationNodesMemo = [query, operationDefinitions]
  return operationDefinitions
}

const getOperationName = (operationDefinition) =>
  operationDefinition.name ? operationDefinition.name.value : operationDefinition.operation

const getOperationDisplayName = (operationDefinition) =>
  operationDefinition.name ? operationDefinition.name.value : `<Unnamed:${operationDefinition.operation}>`

const formatVariableName = (name) => {
  const uppercasePattern = /[A-Z]/g

  return name.charAt(0).toUpperCase() + name.slice(1).replace(uppercasePattern, '_$&').toUpperCase()
}

const getUsedVariables = (variables, operationDefinition) =>
  (operationDefinition.variableDefinitions || []).reduce((usedVariables, variable) => {
    const variableName = variable.variable.name.value
    if (variables[variableName]) {
      usedVariables[variableName] = variables[variableName]
    }

    return usedVariables
  }, {})

const findFragmentDependencies = (operationDefinitions, definition) => {
  const fragmentByName = (name) => operationDefinitions.find((def) => def.name.value === name)

  const findReferencedFragments = (selectionSet) => {
    const { selections } = selectionSet

    const namedFragments = selections
      .map((selection) => {
        if (selection.kind === 'FragmentSpread') {
          return fragmentByName(selection.name.value)
        }
        return null
      })
      .filter(Boolean)

    const nestedNamedFragments = selections.reduce((acc, selection) => {
      if (
        (selection.kind === 'Field' || selection.kind === 'SelectionNode' || selection.kind === 'InlineFragment') &&
        selection.selectionSet !== undefined
      ) {
        return [...acc, ...findReferencedFragments(selection.selectionSet)]
      }
      return acc
    }, [])

    return [...namedFragments, ...nestedNamedFragments]
  }

  const { selectionSet } = definition

  return findReferencedFragments(selectionSet)
}

const operationDataByName = (graph, name) => graph.find((operationData) => operationData.name === name)

const topologicalSortHelper = ({ graph, node, temp, visited }, result) => {
  temp[node.name] = true
  const neighbors = node.fragmentDependencies
  neighbors.forEach((fragmentDependency) => {
    const fragmentOperationData = operationDataByName(graph, fragmentDependency.name.value)

    if (!fragmentOperationData) {
      return
    }

    if (temp[fragmentOperationData.name]) {
      console.error('The operation graph has a cycle')
      return
    }
    if (!visited[fragmentOperationData.name]) {
      topologicalSortHelper(
        {
          node: fragmentOperationData,
          visited,
          temp,
          graph,
        },
        result,
      )
    }
  })
  temp[node.name] = false
  visited[node.name] = true
  result.push(node)
}

const toposort = (graph) => {
  const result = []
  const visited = {}
  const temp = {}
  graph.forEach((node) => {
    if (!visited[node.name] && !temp[node.name]) {
      topologicalSortHelper({ node, visited, temp, graph }, result)
    }
  })
  return result
}

const computeOperationDataList = ({ query, variables }) => {
  const operationDefinitions = getOperationNodes(query)

  const fragmentDefinitions = []

  operationDefinitions.forEach((operationDefinition) => {
    if (operationDefinition.kind === 'FragmentDefinition') {
      fragmentDefinitions.push(operationDefinition)
    }
  })

  const rawOperationDataList = operationDefinitions.map((operationDefinition) => ({
    query: print(operationDefinition),
    name: getOperationName(operationDefinition),
    displayName: getOperationDisplayName(operationDefinition),
    // $FlowFixMe: Come back for this
    type: operationDefinition.operation || 'fragment',
    variableName: formatVariableName(getOperationName(operationDefinition)),
    variables: getUsedVariables(variables, operationDefinition),
    operationDefinition,
    fragmentDependencies: findFragmentDependencies(fragmentDefinitions, operationDefinition),
  }))

  const operationDataList = toposort(rawOperationDataList)

  return {
    operationDefinitions,
    fragmentDefinitions,
    rawOperationDataList,
    operationDataList,
  }
}

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
    return {
      statusCode: 422,
      body: JSON.stringify({
        error: 'You must supply parameters for: ${message}'
      }),
    };
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

      return `async function ${operationFunctionName(namedOperationData)}(${
        useClientAuth ? 'oneGraphAuth, ' : ''
      }params) {
  const {${params.join(', ')}} = params || {};
  const resp = await fetch(\`/.netlify/functions/${namedOperationData.name}${
        pluckerStyle === 'get' ? `?${params.map((param) => `${param}=\${${param}}`).join('&')}` : ''
      }\`,
    {
      method: "${pluckerStyle.toLocaleUpperCase()}"${
        pluckerStyle === 'get'
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
${imp(netligraphConfig, 'Netligraph', './netligraph')}

${exp(netligraphConfig, 'handler')} = async (event, context) => {
  let secrets = await getSecrets(event);

  const payload = Netligraph.parseAndVerify${operationData.name}Event(event);

  if (!payload) {
    return {
      statusCode: 412,
      data: JSON.stringify({
        success: false,
        error: 'Unable to verify payload signature',
      }),
    };
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
   * return {
   *   statusCode: 410,
   *   body: JSON.stringify(null),
   *   headers: {
   *     'content-type': 'application/json',
   *   },
   * }
   */

  return {
    statusCode: 200,
    body: JSON.stringify({
      successfullyProcessedIncomingWebhook: true,
    }),
    headers: {
      'content-type': 'application/json',
    },
  };
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
const netlifyFunctionSnippet = {
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
${imp(netligraphConfig, 'Netligraph', './netligraph')}

${exp(netligraphConfig, 'handler')} = async (event, context) => {
  // By default, all API calls use no authentication
  let accessToken = null;

  //// If you want to use the client's accessToken when making API calls on the user's behalf:
  // accessToken = event.headers["authorization"]?.split(" ")[1]

  //// If you want to use the API with your own access token:
  // accessToken = (await getSecrets(event))?.oneGraph?.bearerToken;
      
  const eventBodyJson = JSON.parse(event.body || "{}");

  ${fetcherInvocation}

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
${addLeftWhitespace(passThroughResults, whitespace)}
    }),
    headers: {
      'content-type': 'application/json',
    },
  };
};

/** 
 * Client-side invocations:
 * Call your Netlify function from the browser (after saving
 * the code to \`${filename}\`) with these helpers:
 */

/**
${clientSideCalls}
*/

`

    return collapseExtraNewlines(snippet)
  },
}

module.exports = { computeOperationDataList, netlifyFunctionSnippet }
