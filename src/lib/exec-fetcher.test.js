// @ts-check
const process = require('process')

const ghReleaseFetch = require('gh-release-fetch')
const stripAnsi = require('strip-ansi')

const fetchLatestSpy = jest.spyOn(ghReleaseFetch, 'fetchLatest')

const { fetchLatestVersion, getArch, getExecName } = require('./exec-fetcher')

afterEach(() => {
  jest.clearAllMocks()
})

test(`should use 386 if process architecture is ia32`, () => {
  Object.defineProperty(process, 'arch', { value: 'ia32' })
  expect(getArch()).toBe('386')
})

test(`should use amd64 if process architecture is x64`, () => {
  Object.defineProperty(process, 'arch', { value: 'x64' })
  expect(getArch()).toBe('amd64')
})

test(`should append .exe on windows for the executable name`, () => {
  Object.defineProperty(process, 'platform', { value: 'win32' })
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(`${execName}.exe`)
})

test(`should not append anything on linux or darwin to executable`, () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' })
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(execName)
  Object.defineProperty(process, 'platform', { value: 'linux' })
  expect(getExecName({ execName })).toBe(execName)
})

test('should test if an error is thrown if the cpu architecture and the os are not available', async () => {
  Object.defineProperties(process, {
    platform: { value: 'windows' },
    arch: { value: 'amd64' },
  })

  // eslint-disable-next-line prefer-promise-reject-errors
  fetchLatestSpy.mockReturnValue(Promise.reject({ statusCode: 404 }))

  try {
    await fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    })
  } catch (error) {
    expect(stripAnsi(error.message)).toMatch(
      'The operating system windows with the CPU architecture amd64 is currently not supported!',
    )
  }
  expect.assertions(1)
})

test('should provide the error if it is not a 404', async () => {
  const error = new Error('Got Rate limited for example')

  fetchLatestSpy.mockReturnValue(Promise.reject(error))

  try {
    await fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    })
  } catch (error_) {
    expect(error_.message).toBe(error.message)
  }
  expect.assertions(1)
})

test('should map linux x64 to amd64 arch', async () => {
  Object.defineProperties(process, {
    platform: { value: 'linux' },
    arch: { value: 'x64' },
  })
  // eslint-disable-next-line prefer-promise-reject-errors
  fetchLatestSpy.mockReturnValue(Promise.reject({ statusCode: 404 }))

  try {
    await fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    })
  } catch (error) {
    expect(stripAnsi(error.message)).toMatch(
      'The operating system linux with the CPU architecture amd64 is currently not supported!',
    )
  }
  expect.assertions(1)
})

test('should not throw when the request passes', async () => {
  fetchLatestSpy.mockReturnValue(Promise.resolve())

  // should just pass
  await fetchLatestVersion({
    packageName: 'traffic-mesh-agent',
    execName: 'traffic-mesh',
    destination: '',
    extension: 'zip',
  })
})
