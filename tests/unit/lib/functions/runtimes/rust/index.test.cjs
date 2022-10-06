const test = require('ava')
const sinon = require('sinon')

const { rewiremock } = require('../../../../../integration/utils/rewiremock.cjs')

const runFunctionsProxySpy = sinon.stub()
const { invokeFunction } = rewiremock.proxy(
  // eslint-disable-next-line n/global-require
  () => require('../../../../../../src/lib/functions/runtimes/rust/index.cjs'),
  {
    '../../../../../../src/lib/functions/local-proxy.cjs': {
      runFunctionsProxy: runFunctionsProxySpy,
    },
  },
)

const invokeFunctionMacro = test.macro({
  async exec(t, prop, expected) {
    runFunctionsProxySpy.resolves({ stdout: JSON.stringify({ [prop]: expected }) })

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
