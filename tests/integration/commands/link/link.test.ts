import { join } from 'path'
import process from 'process'

import { describe, expect, test } from 'vitest'

import { isFileAsync } from '../../../../src/lib/fs.js'
import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.ts'

describe('link command', () => {
  test('should create gitignore in repository root when is root', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().build()

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
    async (t) => {
      await withSiteBuilder(t, async (builder) => {
        const projectPath = join('projects', 'project1')
        await builder.withGit().withNetlifyToml({ config: {}, pathPrefix: projectPath }).build()

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
