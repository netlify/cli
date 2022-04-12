// @ts-check
const process = require('process')

/** @type {import('ava').TestInterface} */
// @ts-ignore
const test = require('ava')
const sinon = require('sinon')

const { rewiremock } = require('../../integration/utils/rewiremock')

const fetchLatestSpy = sinon.stub()
// eslint-disable-next-line n/global-require
const { fetchLatestVersion, getArch, getExecName } = rewiremock.proxy(() => require('../../../src/lib/exec-fetcher'), {
  'gh-release-fetch': {
    fetchLatest: fetchLatestSpy,
  },
})

test.beforeEach((t) => {
  t.context.sandbox = sinon.createSandbox()
})

test.afterEach((t) => {
  t.context.sandbox.restore()
})

test(`should use 386 if process architecture is ia32`, (t) => {
  t.context.sandbox.stub(process, 'arch').value('ia32')
  t.is(getArch(), '386')
})

test(`should use amd64 if process architecture is x64`, (t) => {
  t.context.sandbox.stub(process, 'arch').value('x64')
  t.is(getArch(), 'amd64')
})

test(`should append .exe on windows for the executable name`, (t) => {
  t.context.sandbox.stub(process, 'platform').value('win32')
  const execName = 'some-binary-file'
  t.is(getExecName({ execName }), `${execName}.exe`)
})

test(`should not append anything on linux or darwin to executable`, (t) => {
  t.context.sandbox.stub(process, 'platform').value('darwin')
  const execName = 'some-binary-file'
  t.is(getExecName({ execName }), execName)
  t.context.sandbox.stub(process, 'platform').value('linux')
  t.is(getExecName({ execName }), execName)
})

test('should test if an error is thrown if the cpu architecture and the os are not available', async (t) => {
  t.context.sandbox.stub(process, 'platform').value('windows')
  t.context.sandbox.stub(process, 'arch').value('amd64')

  // eslint-disable-next-line prefer-promise-reject-errors
  fetchLatestSpy.returns(Promise.reject({ statusCode: 404 }))

  const { message } = await t.throwsAsync(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: t.context.binPath,
      extension: 'zip',
    }),
  )

  t.regex(message, /The operating system windows with the CPU architecture amd64 is currently not supported!/)
})

test('should provide the error if it is not a 404', async (t) => {
  const error = new Error('Got Rate limited for example')

  fetchLatestSpy.returns(Promise.reject(error))

  const { message } = await t.throwsAsync(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: t.context.binPath,
      extension: 'zip',
    }),
  )

  t.is(message, error.message)
})

test('should map linux x64 to amd64 arch', async (t) => {
  t.context.sandbox.stub(process, 'platform').value('linux')
  t.context.sandbox.stub(process, 'arch').value('x64')

  // eslint-disable-next-line prefer-promise-reject-errors
  fetchLatestSpy.returns(Promise.reject({ statusCode: 404 }))

  const { message } = await t.throwsAsync(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: t.context.binPath,
      extension: 'zip',
    }),
  )

  t.regex(message, /The operating system linux with the CPU architecture amd64 is currently not supported!/)
})

test('should not throw when the request passes', async (t) => {
  fetchLatestSpy.returns(Promise.resolve())

  await t.notThrowsAsync(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: t.context.binPath,
      extension: 'zip',
    }),
  )
})
