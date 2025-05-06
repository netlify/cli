import { join } from 'path'
import process from 'process'

import { describe, expect, test } from 'vitest'

import { isFileAsync } from '../../../../src/lib/fs.js'
import { callCli } from '../../utils/call-cli.js'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

describe('link command', () => {
  test.todo('should link to matching site given `--site-id`')
  test.todo('should print an error and exit when no site with given `--site-id` is found')

  test.todo('should link to matching site given `--site-name`')
  test.todo('should print an error and exit when no site with given `--site-name` is found')

  test('should link to matching site given `--git-remote-url`', async (t) => {
    const siteInfo = {
      id: 'site_id',
      name: 'test-site',
      ssl_url: 'https://test-site.netlify.app',
      admin_url: 'https://app.netlify.com/sites/test-site',
      build_settings: {
        repo_url: 'https://github.com/vibecoder/my-unicorn',
      },
    }
    const routes = [
      {
        path: 'sites',
        response: [siteInfo],
      },
      {
        path: 'sites/site_id',
        response: siteInfo,
      },
    ]
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(
        routes,
        async ({ apiUrl }) => {
          const stdout = (await callCli(
            ['link', '--git-remote-url', 'https://github.com/vibecoder/my-unicorn'],
            getCLIOptions({ builder, apiUrl, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(stdout).toContain('Linked to test-site')
        },
        true,
      )
    })
  })
  test.todo('should print an error and exit when no site with given `--git-remote-url` is found')

  test.todo("should prompt user when a site matching the local git repo's remote origin HTTPS URL is found")

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
          const stdout = (await callCli(
            ['link', '--name', 'app'],
            getCLIOptions({ builder, apiUrl, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

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
          const stdout = (await callCli(
            ['link', '--name', 'ap'],
            getCLIOptions({ builder, apiUrl, env: { NETLIFY_SITE_ID: '' } }),
          )) as string

          expect(stdout).toContain('Linked to next-app-playground')
        },
        true,
      )
    })
  })
})
