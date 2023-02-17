import { join } from 'path'
import process from 'process'

import { describe, expect, test } from 'vitest'

import { isFileAsync } from '../../../../src/lib/fs.mjs'
import callCli from '../../utils/call-cli.cjs'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

describe('link command', () => {
  test('should create gitignore in repository root when is root', async () => {
    await withSiteBuilder('repo', async (builder) => {
      await builder.withGit().buildAsync()

      await withMockApi(
        [],
        async ({ apiUrl }) => {
          await callCli(['link'], getCLIOptions({ builder, apiUrl }))

          expect(await isFileAsync(join(builder.directory, '.gitignore'))).toBe(true)
        },
        true,
      )
    })
  })

  test.skipIf(process.platform === 'win32')(
    'should create gitignore in repository root when cwd is subdirectory',
    async () => {
      await withSiteBuilder('monorepo', async (builder) => {
        const projectPath = join('projects', 'project1')
        await builder.withGit().withNetlifyToml({ config: {}, pathPrefix: projectPath }).buildAsync()

        await withMockApi(
          [],
          async ({ apiUrl }) => {
            const options = getCLIOptions({ builder, apiUrl })
            await callCli(['link'], { ...options, cwd: join(builder.directory, projectPath) })

            expect(await isFileAsync(join(builder.directory, '.gitignore'))).toBe(true)
          },
          true,
        )
      })
    },
  )
})
