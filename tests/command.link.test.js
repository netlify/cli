const process = require('process')

const { isFileAsync } = require('../src/lib/fs')

const callCli = require('./utils/call-cli')
const { getCLIOptions, withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

// TODO: Flaky tests enable once fixed
/**
 * As some of the tests are flaky on windows machines I will skip them for now
 * @type {import('ava').TestInterface}
 */
const windowsSkip = process.platform === 'win32' ? test.skip : test

beforeEach(() => {
  // mock console warn to not pollute stdout
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})

test('should create gitignore in repository root when is root', async () => {
  await withSiteBuilder('repo', async (builder) => {
    await builder.withGit().buildAsync()

    await withMockApi([], async ({ apiUrl }) => {
      await callCli(['link'], getCLIOptions({ builder, apiUrl }))

      expect(await isFileAsync(`${builder.directory}/.gitignore`)).toBe(true)
    })
  })
})

windowsSkip('should create gitignore in repository root when cwd is subdirectory', async () => {
  await withSiteBuilder('monorepo', async (builder) => {
    const projectPath = 'projects/project1'
    await builder.withGit().withNetlifyToml({ config: {}, pathPrefix: projectPath }).buildAsync()

    await withMockApi([], async ({ apiUrl }) => {
      const options = getCLIOptions({ builder, apiUrl })
      await callCli(['link'], { ...options, cwd: `${builder.directory}/${projectPath}` })

      expect(await isFileAsync(`${builder.directory}/.gitignore`)).toBe(true)
    })
  })
})
