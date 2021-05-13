const test = require('ava')

const { isFileAsync } = require('../src/lib/fs')

const callCli = require('./utils/call-cli')
const { withMockApi, getCLIOptions } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

test('should create gitignore in repository root when is root', async (t) => {
  await withSiteBuilder('repo', async (builder) => {
    await builder.withGit().buildAsync()

    await withMockApi([], async ({ apiUrl }) => {
      await callCli(['link'], getCLIOptions({ builder, apiUrl }))

      t.true(await isFileAsync(`${builder.directory}/.gitignore`))
    })
  })
})

test('should create gitignore in repository root when cwd is subdirectory', async (t) => {
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
