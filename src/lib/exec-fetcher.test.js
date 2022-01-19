// @ts-check

/** @type {import('ava').TestInterface} */
// @ts-ignore
const test = require('ava')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

// is not a function therefore use Object.defineProperty to mock it
const processSpy = {}
const fetchLatestSpy = sinon.stub()

const { fetchLatestVersion, getArch, getExecName } = proxyquire('./exec-fetcher', {
  'gh-release-fetch': {
    fetchLatest: fetchLatestSpy,
  },
  process: processSpy,
})

test(`should use 386 if process architecture is ia32`, (t) => {
  Object.defineProperty(processSpy, 'arch', { value: 'ia32' })
  t.is(getArch(), '386')
})

test(`should use amd64 if process architecture is x64`, (t) => {
  Object.defineProperty(processSpy, 'arch', { value: 'x64' })
  t.is(getArch(), 'amd64')
})

test(`should append .exe on windows for the executable name`, (t) => {
  Object.defineProperty(processSpy, 'platform', { value: 'win32' })
  const execName = 'some-binary-file'
  t.is(getExecName({ execName }), `${execName}.exe`)
})

test(`should not append anything on linux or darwin to executable`, (t) => {
  Object.defineProperty(processSpy, 'platform', { value: 'darwin' })
  const execName = 'some-binary-file'
  t.is(getExecName({ execName }), execName)
  Object.defineProperty(processSpy, 'platform', { value: 'linux' })
  t.is(getExecName({ execName }), execName)
})

test('should test if an error is thrown if the cpu architecture and the os are not available', async (t) => {
  Object.defineProperties(processSpy, {
    platform: { value: 'windows' },
    arch: { value: 'amd64' },
  })

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
  Object.defineProperties(processSpy, {
    platform: { value: 'linux' },
    arch: { value: 'x64' },
  })
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
