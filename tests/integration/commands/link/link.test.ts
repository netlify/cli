import { join } from 'path'
import process from 'process'

import { describe, expect, test } from 'vitest'

import { isFileAsync } from '../../../../src/lib/fs.js'
import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

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

describe('link command with multiple sites', () => {
  const siteInfo1 = {
    id: 'site_id1',
    name: 'next-app-playground',
  }

  const siteInfo2 = {
    id: 'site_id2',
    name: 'app',
  }

  const routes = [
    {
      path: 'sites',
      response: [siteInfo1, siteInfo2],
    },
  ]

  test('should prefer exact name match when available', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const stdout = await callCli(
            ['link', '--name', 'app'],
            getCLIOptions({ builder, apiUrl, env: { NETLIFY_SITE_ID: '' } }),
          )

          expect(stdout).toContain('Linked to app')
        },
        true,
      )
    })
  })

  test('should use first site when name flag is not an exact match', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const stdout = await callCli(
            ['link', '--name', 'ap'],
            getCLIOptions({ builder, apiUrl, env: { NETLIFY_SITE_ID: '' } }),
          )

          expect(stdout).toContain('Linked to next-app-playground')
        },
        true,
      )
    })
  })
})
