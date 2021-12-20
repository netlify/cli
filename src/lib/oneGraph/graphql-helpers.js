const { TypeInfo, getNamedType, isEnumType, isInputObjectType, isInterfaceType, isListType, isNonNullType, isObjectType, isUnionType, isWrappingType, parseType, print, typeFromAST, visit, visitWithTypeInfo, } = require('graphql');

const capitalizeFirstLetter = (string) =>
    string.charAt(0).toUpperCase() + string.slice(1);


const gatherAllReferencedTypes = (schema, query) => {
    const types = new Set([]);
    const typeInfo = new TypeInfo(schema);
    visit(query, visitWithTypeInfo(typeInfo, {
        enter: () => {
            const fullType = typeInfo.getType();
            if (fullType) {
                const typ = getNamedType(fullType);
                if (typ)
                    types.add(typ.name.toLocaleLowerCase().replace('oneme', ''));
            }
        },
    }));
    const result = [...types];
    return result;
}

const gatherVariableDefinitions = (definition) => {
    const extract = (varDef) => [
        varDef.variable.name.value,
        print(varDef.type),
    ];
    return (definition?.variableDefinitions?.map(extract) || []).sort(([a], [b]) => a.localeCompare(b));
}

const typeScriptForGraphQLType = (schema, gqlType) => {
    const scalarMap = {
        String: 'string',
        ID: 'string',
        Int: 'number',
        Float: 'number',
        Boolean: 'boolean',
    };
    if (isListType(gqlType)) {
        const subType = typeScriptForGraphQLType(schema, gqlType.ofType);
        return `Array<${subType}>`;
    }
    if (isObjectType(gqlType) || isInputObjectType(gqlType)) {
        const fields = Object.values(gqlType.getFields()).map((field) => {
            const nullable = !isNonNullType(field.type);
            const type = typeScriptForGraphQLType(schema, field.type);
            const description = field.description
                ? `/**
* ${field.description}
*/
`
                : '';
            return `${description}"${field.name}"${nullable ? '?' : ''}: ${type}`;
        });
        return `{${fields.join(', ')}}`;
    }
    if (isWrappingType(gqlType)) {
        return typeScriptForGraphQLType(schema, gqlType.ofType);
    }
    if (isEnumType(gqlType)) {
        const values = gqlType.getValues();
        const enums = values.map((enumValue) => `"${enumValue.value}"`);
        return enums.join(' | ');
    }

    const namedType = getNamedType(gqlType);
    // @ts-ignore metaprogramming
    const basicType = scalarMap[namedType?.name] || 'any';
    return basicType;

}

const typeScriptSignatureForOperationVariables = (variableNames, schema, operationDefinition) => {
    const helper = (variableDefinition) => {
        const variableName = variableDefinition.variable.name.value;
        const result = [
            variableName,
            variableDefinition,
        ];
        return result;
    };
    const variables = (operationDefinition.variableDefinitions || [])
        .map(helper)
        .filter(([variableName]) => variableNames.includes(variableName));
    const typesObject = variables.map(([varName, varDef]) => {
        const printedType = print(varDef.type);
        const parsedType = parseType(printedType);
        // @ts-ignore
        const gqlType = typeFromAST(schema, parsedType);
        // @ts-ignore
        const tsType = typeScriptForGraphQLType(schema, gqlType);
        return [varName, tsType];
    });
    const typeFields = typesObject
        .map(([name, tsType]) => `"${name}": ${tsType}`)
        .join(', ');
    const types = `{${typeFields}}`;
    return types === '' ? 'null' : types;
}

// @ts-ignore
const listCount = (gqlType) => {
    let inspectedType = gqlType;
    let listCount = 0;
    let totalCount = 0;
    while (isWrappingType(inspectedType)) {
        if (isListType(inspectedType)) {
            listCount += 1;
        }
        totalCount += 1;
        if (totalCount > 30) {
            console.warn('Bailing on potential infinite recursion');
            return -99;
        }
        inspectedType = inspectedType.ofType;
    }
    return listCount;
}

const typeScriptDefinitionObjectForOperation = (schema, operationDefinition, fragmentDefinitions, shouldLog = true) => {
    const scalarMap = {
        String: 'string',
        ID: 'string',
        Int: 'number',
        Float: 'number',
        Boolean: 'boolean',
        GitHubGitObjectID: 'string',
        // JSON: "JSON",
    };
    // @ts-ignore
    const helper = (parentGqlType, selection) => {
        if (!parentGqlType) {
            return;
        }
        const parentNamedType =
            // @ts-ignore
            getNamedType(parentGqlType) || getNamedType(parentGqlType.type);
        const alias = selection.alias?.value;
        const name = selection?.name?.value;
        const displayedName = alias || name;
        // @ts-ignore
        const field = parentNamedType.getFields()[name];
        const gqlType = field?.type;
        if (name.startsWith('__')) {
            return [
                displayedName,
                { type: 'any', description: 'Internal GraphQL field' },
            ];
        }
        const namedType = getNamedType(gqlType);
        const isNullable = !isNonNullType(gqlType);
        const isList = isListType(gqlType) || (!isNullable && isListType(gqlType.ofType));
        const isObjectLike = isObjectType(namedType) ||
            isUnionType(namedType) ||
            isInterfaceType(namedType);
        const sub = selection.selectionSet?.selections
            // @ts-ignore
            .map(function innerHelper(selection) {
                if (selection.kind === 'Field') {
                    return helper(namedType, selection);
                }
                if (selection.kind === 'InlineFragment') {
                    const fragmentGqlType = typeFromAST(schema, selection.typeCondition);
                    if (!fragmentGqlType) {
                        return null;
                    }
                    const fragmentSelections = selection.selectionSet.selections.map(
                        // @ts-ignore
                        (subSelection) => {
                            const subSel = helper(fragmentGqlType, subSelection);
                            return subSel;
                        });
                    return fragmentSelections;
                }
                if (selection.kind === 'FragmentSpread') {
                    const fragmentName = [selection.name.value];
                    // @ts-ignore
                    const fragment = fragmentDefinitions[fragmentName];
                    if (fragment) {
                        const fragmentGqlType = typeFromAST(schema, fragment.typeCondition);
                        if (!fragmentGqlType) {
                            return null;
                        }
                        const fragmentSelections = fragment.selectionSet.selections.map(innerHelper);
                        return fragmentSelections;
                    }
                }
                return null;
            })
            .filter(Boolean)
            // @ts-ignore
            .reduce((acc, next) => {
                if (Array.isArray(next[0])) {
                    return acc.concat(next);
                }

                return [...acc, next];

            }, []);
        const nestingLevel = isList ? listCount(gqlType) : 0;
        const isEnum = isEnumType(namedType);
        const basicType = isEnum
            ? // @ts-ignore
            new Set(namedType.getValues().map((gqlEnum) => gqlEnum.value))
            : // @ts-ignore
            scalarMap[namedType?.name || 'any'];
        let returnType;
        if (isObjectLike) {
            returnType = sub ? Object.fromEntries(sub) : null;
        }
        else if (basicType) {
            returnType = basicType;
        }
        else {
            returnType = 'any';
        }
        if (returnType) {
            let finalType = returnType;
            for (let i = 0; i < nestingLevel; i++) {
                finalType = [finalType];
            }
            const entry = [
                displayedName,
                { type: finalType, description: field?.description },
            ];
            return entry;
        }
        // @ts-ignore
        console.warn('No returnType!', basicType, namedType.name, selection);
    };
    const baseGqlType = operationDefinition.kind === 'OperationDefinition'
        ? (operationDefinition.operation === 'query'
            ? schema.getQueryType()
            : operationDefinition.operation === 'mutation'
                ? schema.getMutationType()
                : operationDefinition.operation === 'subscription'
                    ? schema.getSubscriptionType()
                    : null)
        : (operationDefinition.kind === 'FragmentDefinition'
            ? // @ts-ignore
            schema.getType(operationDefinition.typeCondition.name.value)
            : null);
    const selections = operationDefinition.selectionSet?.selections;
    const sub = selections?.map((selection) => helper(baseGqlType, selection));
    if (sub) {
        // @ts-ignore
        const object = Object.fromEntries(sub);
        const result = {
            data: {
                type: object,
                description: 'Any data retrieved by the const function be returned here',
            },
            errors: {
                type: ['any'],
                description: 'Any errors in the function will be returned here',
            },
        };
        return result;
    }

    return {
        data: {
            // @ts-ignore
            type: 'any',
            description: 'Any data retrieved by the const function be returned here',
        },
        errors: {
            type: ['any'],
            description: 'Any errors in the function will be returned here',
        },
    };

}

const typeScriptForOperation = (schema, operationDefinition, fragmentDefinitions) => {
    const typeMap = typeScriptDefinitionObjectForOperation(schema, operationDefinition, fragmentDefinitions);
    const valueHelper = (value) => {
        if (value?.type && typeof value.type === 'string') {
            return value.type;
        }
        if (Array.isArray(value.type)) {
            const subType = valueHelper({ type: value.type[0] });
            return `Array<${subType}>`;
        }
        if (value.type instanceof Set) {
            // @ts-ignore
            const enums = [...value.type.values()]
                .map((value) => `"${value}"`)
                .join(' | ');
            return enums;
        }
        if (typeof value.type === 'object') {
            const fields = objectHelper(value.type);
            return `{
      ${fields.join(', ')}
  }`;
        }
    };
    // @ts-ignore
    function objectHelper(obj) {
        return Object.entries(obj).map(([name, value]) => {
            // @ts-ignore
            const { description, type } = value;
            // @ts-ignore
            const tsType = valueHelper(value);
            const doc = description
                ? `/**
* ${description}
*/
`
                : '';
            return `${doc}"${name}": ${tsType}`;
        });
    }
    const fields = objectHelper(typeMap).join(', ');
    return `{${fields}}`;
}

const typeScriptTypeNameForOperation = (name) => `${capitalizeFirstLetter(name)}Payload`

const typeScriptSignatureForOperation = (schema, operationDefinition, fragmentDefinitions) => {
    const types = typeScriptForOperation(schema, operationDefinition, fragmentDefinitions);
    const name = operationDefinition.name?.value || 'unknown';
    return `${types}`;
}

/**
 * Doesn't patch e.g. fragments
 */
const patchSubscriptionWebhookField = ({ definition, schema, }) => {
    if (definition.operation !== 'subscription') {
        return definition;
    }
    const subscriptionType = schema.getSubscriptionType();
    if (!subscriptionType) {
        return definition;
    }
    const newSelections = definition.selectionSet.selections.map((selection) => {
        if (selection.kind !== 'Field')
            return selection;
        const field = subscriptionType.getFields()[selection.name.value];
        const fieldHasWebhookUrlArg = field.args.some((arg) => arg.name === 'webhookUrl');
        const selectionHasWebhookUrlArg = selection.arguments?.some((arg) => arg.name.value === 'webhookUrl');
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
            };
        }
        return selection;
    });
    const hasWebhookVariableDefinition = definition.variableDefinitions?.find((varDef) => varDef.variable.name.value === 'netligraphWebhookUrl');
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
        ];
    return {
        ...definition,
        // @ts-ignore: Handle edge cases later
        variableDefinitions,
        // @ts-ignore: Handle edge cases later
        selectionSet: { ...definition.selectionSet, selections: newSelections },
    };
}

const patchSubscriptionWebhookSecretField = ({ definition, schema, }) => {
    if (definition.operation !== 'subscription') {
        return definition;
    }
    const subscriptionType = schema.getSubscriptionType();
    if (!subscriptionType) {
        return definition;
    }
    const newSelections = definition.selectionSet.selections.map((selection) => {
        if (selection.kind !== 'Field')
            return selection;
        const field = subscriptionType.getFields()[selection.name.value];
        const fieldHasWebhookSecretArg = field.args.some((arg) => arg.name === 'secret');
        const selectionHasWebhookSecretArg = selection.arguments?.some((arg) => arg.name.value === 'secret');
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
            };
        }
        return selection;
    });
    const hasWebhookVariableDefinition = definition.variableDefinitions?.find((varDef) => varDef.variable.name.value === 'netligraphWebhookSecret');
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
        ];
    return {
        ...definition,
        // @ts-ignore: Handle edge cases later
        variableDefinitions,
        // @ts-ignore: Handle edge cases later
        selectionSet: { ...definition.selectionSet, selections: newSelections },
    };
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