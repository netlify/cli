const test = require('ava')
const sinon = require('sinon')

const { rewiremock } = require('../../../../../integration/utils/rewiremock')

const runFunctionsProxySpy = sinon.stub()
// eslint-disable-next-line n/global-require
const { invokeFunction } = rewiremock.proxy(() => require('../../../../../../src/lib/functions/runtimes/go/index'), {
  '../../../../../../src/lib/functions/local-proxy': {
    runFunctionsProxy: runFunctionsProxySpy,
  },
})

const invokeFunctionMacro = test.macro({
  async exec(t, prop, expected) {
    runFunctionsProxySpy.returns(Promise.resolve({ stdout: JSON.stringify({ [prop]: expected }) }))

    const match = await invokeFunction({ func: { mainFile: '', buildData: {} } })
    t.deepEqual(match[prop], expected)
  },
  title(providedTitle, prop) {
    return `should return ${prop}`
  },
})

test(invokeFunctionMacro, 'body', 'thebody')
test(invokeFunctionMacro, 'headers', { 'X-Single': 'A' })
test(invokeFunctionMacro, 'multiValueHeaders', { 'X-Multi': ['B', 'C'] })
test(invokeFunctionMacro, 'statusCode', 200)
