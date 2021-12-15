import test from 'ava'

import { isFileAsync } from '../src/lib/fs.js'

import callCli from './utils/call-cli.js'
import { getCLIOptions, withMockApi } from './utils/mock-api.js'
import { withSiteBuilder } from './utils/site-builder.js'

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
