// @ts-check
const process = require('process')

const test = require('ava')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

// is not a function therefore use Object.defineProperty to mock it
const processSpy = {}
const fetchLatestSpy = sinon.stub()

const { fetchLatestVersion, getExecName } = proxyquire('./exec-fetcher', {
  'gh-release-fetch': {
    fetchLatest: fetchLatestSpy,
  },
  process: processSpy,
})

test(`should postix exec with .exe on windows`, (t) => {
  const execName = 'some-binary-file'
  if (process.platform === 'win32') {
    t.is(getExecName({ execName }), `${execName}.exe`)
  } else {
    t.is(getExecName({ execName }), execName)
  }
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
