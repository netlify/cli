import execa from 'execa'
import { describe, expect, test } from 'vitest'

import { cliPath } from '../../utils/cli-path.js'
import { CONFIRM, YES, handleQuestions } from '../../utils/handle-questions.js'
import { getCLIOptions, withMockApi, type MockApiTestContext, type Route } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const siteInfo = {
  admin_url: 'https://app.netlify.com/projects/site-name/overview',
  ssl_url: 'https://site-name.netlify.app/',
  id: 'site_id',
  name: 'site-name',
  build_settings: { env: {} },
}

const otherSiteInfo = {
  ...siteInfo,
  admin_url: 'https://app.netlify.com/projects/other-site/overview',
  ssl_url: 'https://other-site.netlify.app/',
  id: 'other_site',
  name: 'other-site',
}

const routes: Route[] = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  { path: 'sites/site_id', method: 'DELETE', response: {} },
  { path: 'user', response: { name: 'test user', slug: 'test-user', email: 'user@test.com' } },
  { path: 'accounts', response: [{ slug: 'test-account' }] },
]

const routesWithOtherLinkedSite: Route[] = [
  ...routes,
  { path: 'sites/other_site', response: otherSiteInfo },
  { path: 'sites/other_site/service-instances', response: [] },
]

const CONFIRM_QUESTION = 'Are you sure you want to delete the'
const VERIFY_QUESTION = 'Verify & Proceed with deletion of project'
const DELETED_MESSAGE = 'Project "site_id" successfully deleted!'

const deleteRequests = (requests: MockApiTestContext['requests']) =>
  requests.filter(({ method, path }) => method === 'DELETE' && path === '/api/v1/sites/site_id')

// TESTING_PROMPTS keeps `--force` from being auto-injected into the non-TTY child process
const promptingEnv = { TESTING_PROMPTS: 'true' }

describe('sites:delete command', () => {
  test('deletes the project when the user confirms', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const childProcess = execa(
          cliPath,
          ['sites:delete', 'site_id'],
          getCLIOptions({ apiUrl, builder, env: promptingEnv }),
        )

        handleQuestions(childProcess, [{ question: CONFIRM_QUESTION, answer: YES }])

        const { stdout } = await childProcess

        expect(stdout).toContain('You are about to permanently delete "site-name"')
        expect(stdout).toContain(CONFIRM_QUESTION)
        expect(stdout).toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(1)
      })
    })
  })

  test('does not delete the project when the user declines', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const childProcess = execa(
          cliPath,
          ['sites:delete', 'site_id'],
          getCLIOptions({ apiUrl, builder, env: promptingEnv }),
        )

        handleQuestions(childProcess, [{ question: CONFIRM_QUESTION, answer: CONFIRM }])

        const { exitCode, stdout } = await childProcess

        expect(exitCode).toBe(0)
        expect(stdout).toContain(CONFIRM_QUESTION)
        expect(stdout).not.toContain('Deleting project')
        expect(stdout).not.toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(0)
      })
    })
  })

  test('accepts an answer piped with a line feed, as a shell script sends it', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const childProcess = execa(
          cliPath,
          ['sites:delete', 'site_id'],
          getCLIOptions({ apiUrl, builder, env: promptingEnv }),
        )

        handleQuestions(childProcess, [{ question: CONFIRM_QUESTION, answer: 'y\n' }])

        const { stdout } = await childProcess

        expect(stdout).toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(1)
      })
    })
  })

  test('skips the confirmation prompt with --force', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const { stdout } = await execa(
          cliPath,
          ['sites:delete', 'site_id', '--force'],
          getCLIOptions({ apiUrl, builder, env: promptingEnv }),
        )

        expect(stdout).not.toContain('Warning')
        expect(stdout).not.toContain(CONFIRM_QUESTION)
        expect(stdout).not.toContain(VERIFY_QUESTION)
        expect(stdout).toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(1)
      })
    })
  })

  test('skips the confirmation prompt in a non-interactive shell', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const { stdout } = await execa(cliPath, ['sites:delete', 'site_id'], getCLIOptions({ apiUrl, builder }))

        expect(stdout).not.toContain(CONFIRM_QUESTION)
        expect(stdout).toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(1)
      })
    })
  })

  test('asks for a second confirmation when the id differs from the linked project', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routesWithOtherLinkedSite, async ({ apiUrl, requests }) => {
        const childProcess = execa(
          cliPath,
          ['sites:delete', 'site_id'],
          getCLIOptions({ apiUrl, builder, env: { ...promptingEnv, NETLIFY_SITE_ID: 'other_site' } }),
        )

        handleQuestions(childProcess, [
          { question: CONFIRM_QUESTION, answer: YES },
          { question: VERIFY_QUESTION, answer: YES },
        ])

        const { stdout } = await childProcess

        expect(stdout).toContain('The project ID supplied does not match the current working directory project ID')
        expect(stdout).toMatch(/Supplied:\s+"site_id"/)
        expect(stdout).toMatch(/Current Project:\s+"other_site"/)
        expect(stdout).toContain(VERIFY_QUESTION)
        expect(stdout).toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(1)
      })
    })
  })

  test('does not delete the project when the second confirmation is declined', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routesWithOtherLinkedSite, async ({ apiUrl, requests }) => {
        const childProcess = execa(
          cliPath,
          ['sites:delete', 'site_id'],
          getCLIOptions({ apiUrl, builder, env: { ...promptingEnv, NETLIFY_SITE_ID: 'other_site' } }),
        )

        handleQuestions(childProcess, [
          { question: CONFIRM_QUESTION, answer: YES },
          { question: VERIFY_QUESTION, answer: CONFIRM },
        ])

        const { exitCode, stdout } = await childProcess

        expect(exitCode).toBe(0)
        expect(stdout).toContain(VERIFY_QUESTION)
        expect(stdout).not.toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(0)
      })
    })
  })

  test('does not prompt for the linked-project mismatch with --force', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routesWithOtherLinkedSite, async ({ apiUrl, requests }) => {
        const { stdout } = await execa(
          cliPath,
          ['sites:delete', 'site_id', '--force'],
          getCLIOptions({ apiUrl, builder, env: { ...promptingEnv, NETLIFY_SITE_ID: 'other_site' } }),
        )

        expect(stdout).not.toContain(CONFIRM_QUESTION)
        expect(stdout).not.toContain(VERIFY_QUESTION)
        expect(stdout).toContain(DELETED_MESSAGE)
        expect(deleteRequests(requests)).toHaveLength(1)
      })
    })
  })
})
