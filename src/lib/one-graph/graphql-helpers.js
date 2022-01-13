const dotProp = require('dot-prop')
const {
  TypeInfo,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
  isWrappingType,
  parseType,
  print,
  typeFromAST,
  visit,
  visitWithTypeInfo,
} = require('graphql')

const { warn } = require('../../utils')

const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1)

const gatherAllReferencedTypes = (schema, query) => {
  const types = new Set([])
  const typeInfo = new TypeInfo(schema)
  visit(
    query,
    visitWithTypeInfo(typeInfo, {
      enter: () => {
        const fullType = typeInfo.getType()
        if (fullType) {
          const typ = getNamedType(fullType)
          // We don't want to pick up the `OneMe` type since that should be hidden from the end developer for the first few releases
          if (typ) types.add(typ.name.toLocaleLowerCase().replace('oneme', ''))
        }
      },
    }),
  )
  const result = [...types]
  return result
}

const extractVariableNameStringPair = (varDef) => [varDef.variable.name.value, print(varDef.type)]

const gatherVariableDefinitions = (definition) => {
  const varDefs = dotProp.get(definition, 'variableDefinitions.') || []
  return varDefs.map(extractVariableNameStringPair).sort(([left], [right]) => left.localeCompare(right))
}
const typeScriptForGraphQLType = (schema, gqlType) => {
  const scalarMap = {
    String: 'string',
    ID: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
  }
  if (isListType(gqlType)) {
    const subType = typeScriptForGraphQLType(schema, gqlType.ofType)
    return `Array<${subType}>`
  }
  if (isObjectType(gqlType) || isInputObjectType(gqlType)) {
    const fields = Object.values(gqlType.getFields()).map((field) => {
      const nullable = !isNonNullType(field.type)
      const type = typeScriptForGraphQLType(schema, field.type)
      const description = field.description
        ? `/**
* ${field.description}
*/
`
        : ''
      return `
${description} ${field.name}${nullable ? '?' : ''}: ${type}`
    })
    return `{
  ${fields.join('; ')}
}`
  }
  if (isWrappingType(gqlType)) {
    return typeScriptForGraphQLType(schema, gqlType.ofType)
  }
  if (isEnumType(gqlType)) {
    const values = gqlType.getValues()
    const enums = values.map((enumValue) => `"${enumValue.value}"`)
    return enums.join(' | ')
  }

  const namedType = getNamedType(gqlType)
  // @ts-ignore metaprogramming
  const basicType = scalarMap[namedType && namedType.name] || 'any'
  return basicType
}

const typeScriptSignatureForOperationVariablesHelper = (variableDefinition) => {
  const variableName = variableDefinition.variable.name.value
  const result = [variableName, variableDefinition]
  return result
}

const typeScriptSignatureForOperationVariables = (variableNames, schema, operationDefinition) => {
  const variables = (operationDefinition.variableDefinitions || [])
    .map(typeScriptSignatureForOperationVariablesHelper)
    .filter(([variableName]) => variableNames.includes(variableName))
  const typesObject = variables.map(([varName, varDef]) => {
    const printedType = print(varDef.type)
    const parsedType = parseType(printedType)
    const gqlType = typeFromAST(schema, parsedType)
    const tsType = typeScriptForGraphQLType(schema, gqlType)
    return [varName, tsType]
  })
  const typeFields = typesObject.map(([name, tsType]) => `${name}: ${tsType}`).join(', ')
  const types = `{
  ${typeFields}
}`
  return types === '' ? 'null' : types
}

const listCount = (gqlType) => {
  let inspectedType = gqlType
  let innerListCount = 0
  let totalCount = 0
  const maximumDepth = 30
  // TODO: Clean this up and do things properly
  const errorSigil = -99
  // eslint-disable-next-line fp/no-loops
  while (isWrappingType(inspectedType)) {
    if (isListType(inspectedType)) {
      innerListCount += 1
    }
    totalCount += 1
    if (totalCount > maximumDepth) {
      warn('Bailing on potential infinite recursion')
      return errorSigil
    }
    inspectedType = inspectedType.ofType
  }
  return innerListCount
}

const typeScriptDefinitionObjectForOperation = (schema, operationDefinition, fragmentDefinitions) => {
  const scalarMap = {
    String: 'string',
    ID: 'string',
    Int: 'number',
    Float: 'number',
    Boolean: 'boolean',
    GitHubGitObjectID: 'string',
    // JSON: "JSON",
  }
  // @ts-ignore
  const helper = (parentGqlType, selection) => {
    if (!parentGqlType) {
      return
    }
    const parentNamedType =
      // @ts-ignore
      getNamedType(parentGqlType) || getNamedType(parentGqlType.type)
    const alias = dotProp.get(selection, 'alias.value')
    const name = dotProp.get(selection, 'name.value')
    const displayedName = alias || name
    // @ts-ignore
    const field = parentNamedType.getFields()[name]
    const gqlType = dotProp.get(field, 'type')
    if (name.startsWith('__')) {
      return [
        displayedName,
        {
          type: 'any',
          description: 'Internal GraphQL field',
          nullable: true,
        },
      ]
    }
    const namedType = getNamedType(gqlType)
    const isNullable = !isNonNullType(gqlType)
    const isList = isListType(gqlType) || (!isNullable && isListType(gqlType.ofType))
    const isObjectLike = isObjectType(namedType) || isUnionType(namedType) || isInterfaceType(namedType)
    const sub = dotProp
      .get(selection, 'selectionSet.selections', [])
      // @ts-ignore
      .map(function innerHelper(innerSelection) {
        if (innerSelection.kind === 'Field') {
          return helper(namedType, innerSelection)
        }
        if (innerSelection.kind === 'InlineFragment') {
          const fragmentGqlType = typeFromAST(schema, innerSelection.typeCondition)
          if (!fragmentGqlType) {
            return null
          }
          const fragmentSelections = innerSelection.selectionSet.selections.map(
            // @ts-ignore
            (subSelection) => {
              const subSel = helper(fragmentGqlType, subSelection)
              return subSel
            },
          )
          return fragmentSelections
        }
        if (innerSelection.kind === 'FragmentSpread') {
          const fragmentName = [innerSelection.name.value]
          // @ts-ignore
          const fragment = fragmentDefinitions[fragmentName]
          if (fragment) {
            const fragmentGqlType = typeFromAST(schema, fragment.typeCondition)
            if (!fragmentGqlType) {
              return null
            }
            const fragmentSelections = fragment.selectionSet.selections.map(innerHelper)
            return fragmentSelections
          }
        }
        return null
      })
      .filter(Boolean)
      // @ts-ignore
      .reduce((acc, next) => {
        if (Array.isArray(next[0])) {
          return [...acc, ...next]
        }

        return [...acc, next]
      }, [])
    const nestingLevel = isList ? listCount(gqlType) : 0
    const isEnum = isEnumType(namedType)
    const basicType = isEnum
      ? new Set(namedType.getValues().map((gqlEnum) => gqlEnum.value))
      : scalarMap[(namedType && namedType.name) || 'any']
    let returnType
    if (isObjectLike) {
      returnType = sub ? Object.fromEntries(sub) : null
    } else if (basicType) {
      returnType = basicType
    } else {
      returnType = 'any'
    }
    if (returnType) {
      let finalType = returnType
      // eslint-disable-next-line fp/no-loops
      for (let idx = 0; idx < nestingLevel; idx++) {
        finalType = [finalType]
      }
      const entry = [displayedName, { type: finalType, description: field && field.description, nullable: isNullable }]
      return entry
    }
    // @ts-ignore
    warn('No returnType!', basicType, namedType.name, selection)
  }

  let baseGqlType = null

  if (operationDefinition.kind === 'OperationDefinition') {
    switch (operationDefinition.operation) {
      case 'query':
        baseGqlType = schema.getQueryType()
        break
      case 'mutation':
        baseGqlType = schema.getMutationType()
        break
      case 'subscription':
        baseGqlType = schema.getSubscriptionType()
        break
      default:
        break
    }
  } else if (operationDefinition.kind === 'FragmentDefinition') {
    const typeName = operationDefinition.typeCondition.name.value
    baseGqlType = schema.getType(typeName)
  }

  const selections = dotProp.get(operationDefinition, 'selectionSet.selections')
  const sub = selections && selections.map((selection) => helper(baseGqlType, selection))
  if (sub) {
    // @ts-ignore
    const object = Object.fromEntries(sub)
    const result = {
      data: {
        type: object,
        nullable: true,
        description: 'Any data retrieved by the function be returned here',
      },
      errors: {
        type: ['any'],
        nullable: true,
        description: 'Any errors in the function will be returned here',
      },
    }
    return result
  }

  return {
    data: {
      // @ts-ignore
      type: 'any',
      nullable: true,
      description: 'Any data retrieved by the function be returned here',
    },
    errors: {
      type: ['any'],
      nullable: true,
      description: 'Any errors in the function will be returned here',
    },
  }
}

const typeScriptForOperation = (schema, operationDefinition, fragmentDefinitions) => {
  const typeMap = typeScriptDefinitionObjectForOperation(schema, operationDefinition, fragmentDefinitions)
  const valueHelper = (value) => {
    if (typeof dotProp.get(value, 'type') === 'string') {
      return value.type
    }
    if (Array.isArray(value.type)) {
      const subType = valueHelper({ type: value.type[0] })
      return `Array<${subType}>`
    }
    if (value.type instanceof Set) {
      // @ts-ignore
      const enums = [...value.type.values()].map((innerValue) => `"${innerValue}"`).join(' | ')
      return enums
    }
    if (typeof value.type === 'object') {
      const fields = objectHelper(value.type)
      return `{
      ${fields.join('; ')}
  }`
    }
  }

  const objectHelper = (obj) =>
    Object.entries(obj).map(([name, value]) => {
      const { description } = value
      const tsType = valueHelper(value)
      const { nullable } = value
      const doc = description
        ? `/**
* ${description}
*/
`
        : ''
      return `
${doc} ${name}${nullable ? '?' : ''}: ${tsType}`
    })

  const fields = objectHelper(typeMap).join('; ')
  return `{${fields}}`
}

const typeScriptTypeNameForOperation = (name) => `${capitalizeFirstLetter(name)}Payload`

const typeScriptSignatureForOperation = (schema, operationDefinition, fragmentDefinitions) => {
  const types = typeScriptForOperation(schema, operationDefinition, fragmentDefinitions)
  return `${types}`
}

/**
 * Doesn't patch e.g. fragments
 */
const patchSubscriptionWebhookField = ({ definition, schema }) => {
  if (definition.operation !== 'subscription') {
    return definition
  }
  const subscriptionType = schema.getSubscriptionType()
  if (!subscriptionType) {
    return definition
  }
  const newSelections = definition.selectionSet.selections.map((selection) => {
    if (selection.kind !== 'Field') return selection
    const field = subscriptionType.getFields()[selection.name.value]
    if (!field) {
      warn(
        'Unable to find subscription service field, you may need to enable additional services. Missing field:',
        selection.name.value,
      )
      return selection
    }
    const fieldHasWebhookUrlArg = field.args.some((arg) => arg.name === 'webhookUrl')
    const selectionHasWebhookUrlArg = dotProp
      .get(selection, 'arguments', [])
      .some((arg) => arg.name.value === 'webhookUrl')
    if (fieldHasWebhookUrlArg && !selectionHasWebhookUrlArg) {
      return {
        ...selection,
        arguments: [
          ...(selection.arguments || []),
          {
            kind: 'Argument',
            name: {
              kind: 'Name',
              value: 'webhookUrl',
            },
            value: {
              kind: 'Variable',
              name: {
                kind: 'Name',
                value: 'netligraphWebhookUrl',
              },
            },
          },
        ],
      }
    }
    return selection
  })
  const hasWebhookVariableDefinition =
    definition.variableDefinitions &&
    definition.variableDefinitions.find((varDef) => varDef.variable.name.value === 'netligraphWebhookUrl')
  const variableDefinitions = hasWebhookVariableDefinition
    ? definition.variableDefinitions
    : [
      ...(definition.variableDefinitions || []),
      {
        kind: 'VariableDefinition',
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'String',
            },
          },
        },
        variable: {
          kind: 'Variable',
          name: {
            kind: 'Name',
            value: 'netligraphWebhookUrl',
          },
        },
      },
    ]
  return {
    ...definition,
    // @ts-ignore: Handle edge cases later
    variableDefinitions,
    // @ts-ignore: Handle edge cases later
    selectionSet: { ...definition.selectionSet, selections: newSelections },
  }
}

const patchSubscriptionWebhookSecretField = ({ definition, schema }) => {
  if (definition.operation !== 'subscription') {
    return definition
  }
  const subscriptionType = schema.getSubscriptionType()
  if (!subscriptionType) {
    return definition
  }
  const newSelections = definition.selectionSet.selections.map((selection) => {
    if (selection.kind !== 'Field') return selection
    const field = subscriptionType.getFields()[selection.name.value]
    if (!field) {
      warn(
        'Unable to find subscription service field, you may need to enable additional services. Missing field:',
        selection.name.value,
      )
      return selection
    }
    const fieldHasWebhookSecretArg = field.args.some((arg) => arg.name === 'secret')
    const selectionHasWebhookSecretArg = dotProp
      .get(selection, 'arguments', [])
      .some((arg) => arg.name.value === 'secret')
    if (fieldHasWebhookSecretArg && !selectionHasWebhookSecretArg) {
      return {
        ...selection,
        arguments: [
          ...(selection.arguments || []),
          {
            kind: 'Argument',
            name: {
              kind: 'Name',
              value: 'secret',
            },
            value: {
              kind: 'Variable',
              name: {
                kind: 'Name',
                value: 'netligraphWebhookSecret',
              },
            },
          },
        ],
      }
    }
    return selection
  })
  const hasWebhookVariableDefinition = dotProp
    .get(definition, 'variableDefinitions', [])
    .find((varDef) => varDef.variable.name.value === 'netligraphWebhookSecret')
  const variableDefinitions = hasWebhookVariableDefinition
    ? definition.variableDefinitions
    : [
      ...(definition.variableDefinitions || []),
      {
        kind: 'VariableDefinition',
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: 'OneGraphSubscriptionSecretInput',
            },
          },
        },
        variable: {
          kind: 'Variable',
          name: {
            kind: 'Name',
            value: 'netligraphWebhookSecret',
          },
        },
      },
    ]
  return {
    ...definition,
    // @ts-ignore: Handle edge cases later
    variableDefinitions,
    // @ts-ignore: Handle edge cases later
    selectionSet: { ...definition.selectionSet, selections: newSelections },
  }
}

module.exports = {
  capitalizeFirstLetter,
  gatherAllReferencedTypes,
  gatherVariableDefinitions,
  typeScriptForGraphQLType,
  typeScriptSignatureForOperationVariables,
  listCount,
  typeScriptDefinitionObjectForOperation,
  typeScriptForOperation,
  typeScriptTypeNameForOperation,
  typeScriptSignatureForOperation,
  patchSubscriptionWebhookField,
  patchSubscriptionWebhookSecretField,
}
