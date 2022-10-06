const process = require('process')

const test = require('ava')

const { isFileAsync } = require('../../src/lib/fs.cjs')

const callCli = require('./utils/call-cli.cjs')
const { getCLIOptions, withMockApi } = require('./utils/mock-api.cjs')
const { withSiteBuilder } = require('./utils/site-builder.cjs')

// TODO: Flaky tests enable once fixed
/**
 * As some of the tests are flaky on windows machines I will skip them for now
 * @type {import('ava').TestInterface}
 */
const windowsSkip = process.platform === 'win32' ? test.skip : test

test('should create gitignore in repository root when is root', async (t) => {
  await withSiteBuilder('repo', async (builder) => {
    await builder.withGit().buildAsync()

    await withMockApi([], async ({ apiUrl }) => {
      await callCli(['link'], getCLIOptions({ builder, apiUrl }))

      t.true(await isFileAsync(`${builder.directory}/.gitignore`))
    })
  })
})

windowsSkip('should create gitignore in repository root when cwd is subdirectory', async (t) => {
  await withSiteBuilder('monorepo', async (builder) => {
    const projectPath = 'projects/project1'
    await builder.withGit().withNetlifyToml({ config: {}, pathPrefix: projectPath }).buildAsync()

    await withMockApi([], async ({ apiUrl }) => {
      const options = getCLIOptions({ builder, apiUrl })
      await callCli(['link'], { ...options, cwd: `${builder.directory}/${projectPath}` })

      t.true(await isFileAsync(`${builder.directory}/.gitignore`))
    })
  })
})
