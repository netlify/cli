import process from 'process'

import { fetchLatest } from 'gh-release-fetch'
import { afterAll, afterEach, beforeAll, expect, test, vi, type MockInstance } from 'vitest'

import { fetchLatestVersion, getArch, getExecName } from '../../../src/lib/exec-fetcher.js'

vi.mock('gh-release-fetch', async () => {
  const actual = await vi.importActual<typeof import('gh-release-fetch')>('gh-release-fetch')

  return {
    ...actual,
    fetchLatest: vi.fn(actual.fetchLatest),
  }
})

let processArchSpy: MockInstance<() => typeof process.arch>
let processPlatformSpy: MockInstance<() => typeof process.platform>

beforeAll(() => {
  processArchSpy = vi.spyOn(process, 'arch', 'get')
  processPlatformSpy = vi.spyOn(process, 'platform', 'get')
})

afterEach(() => {
  vi.clearAllMocks()
  processArchSpy.mockReset()
  processPlatformSpy.mockReset()
})

afterAll(() => {
  vi.restoreAllMocks()
})

test(`should use 386 if process architecture is ia32`, () => {
  processArchSpy.mockReturnValue('ia32')
  expect(getArch()).toBe('386')
})

test(`should use amd64 if process architecture is x64`, () => {
  processArchSpy.mockReturnValue('x64')
  expect(getArch()).toBe('amd64')
})

test(`should append .exe on windows for the executable name`, () => {
  processPlatformSpy.mockReturnValue('win32')
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(`${execName}.exe`)
})

test(`should not append anything on darwin to executable`, () => {
  processPlatformSpy.mockReturnValue('darwin')
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(execName)
})

test(`should not append anything on linux to executable`, () => {
  processPlatformSpy.mockReturnValue('linux')
  const execName = 'some-binary-file'
  expect(getExecName({ execName })).toBe(execName)
})

test('should test if an error is thrown if the cpu architecture and the os are not available', async () => {
  processArchSpy.mockReturnValue('x64')
  processPlatformSpy.mockReturnValue('win32')
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  vi.mocked(fetchLatest).mockReturnValue(Promise.reject({ statusCode: 404 }))

  await expect(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    }),
  ).rejects.toThrowError(/The operating system windows with the CPU architecture amd64 is currently not supported!/)
})

test('should provide the error if it is not a 404', async () => {
  const error = new Error('Got Rate limited for example')

  vi.mocked(fetchLatest).mockReturnValue(Promise.reject(error))

  await expect(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    }),
  ).rejects.toThrowError(error.message)
})

test('should map linux x64 to amd64 arch', async () => {
  processArchSpy.mockReturnValue('x64')
  processPlatformSpy.mockReturnValue('linux')
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
  vi.mocked(fetchLatest).mockReturnValue(Promise.reject({ statusCode: 404 }))

  await expect(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    }),
  ).rejects.toThrowError(/The operating system linux with the CPU architecture amd64 is currently not supported!/)
})

test('should not throw when the request passes', async () => {
  vi.mocked(fetchLatest).mockReturnValue(Promise.resolve(undefined))

  await expect(
    fetchLatestVersion({
      packageName: 'traffic-mesh-agent',
      execName: 'traffic-mesh',
      destination: '',
      extension: 'zip',
    }),
  ).resolves.not.toThrowError()
})
