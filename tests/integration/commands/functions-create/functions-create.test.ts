import { readFile } from 'fs/promises'

import execa from 'execa'
import { describe, expect, test } from 'vitest'

import { fileExistsAsync } from '../../../../src/lib/fs.mjs'
import cliPath from '../../utils/cli-path.cjs'
import { answerWithValue, CONFIRM, DOWN, handleQuestions } from '../../utils/handle-questions.cjs'
import { getCLIOptions, withMockApi } from '../../utils/mock-api.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

describe.concurrent('functions:create command', () => {
  test('should create a new function directory when none is found', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(`${DOWN}${CONFIRM}`),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Select the language of your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(true)
      })
    })
  })

  test('should create a new edge function directory when none is found', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Select the language of your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'What route do you want your edge function to be invoked on?',
          answer: answerWithValue('/test'),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/netlify/edge-functions/hello/hello.js`)).toBe(true)
      })
    })
  })

  test('should use specified edge function directory when found', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-custom-edge-functions-dir', async (builder) => {
      builder.withNetlifyToml({ config: { build: { edge_functions: 'somethingEdgy' } } })

      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Select the language of your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'What route do you want your edge function to be invoked on?',
          answer: answerWithValue('/test'),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/somethingEdgy/hello/hello.js`)).toBe(true)
      })
    })
  })

  test('should install function template dependencies on a site-level `package.json` if one is found', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-no-functions-dir-with-package-json', async (builder) => {
      builder.withPackageJson({
        packageJson: {
          dependencies: {
            '@netlify/functions': '^0.1.0',
          },
        },
      })

      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(`${DOWN}${CONFIRM}`),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Select the language of your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(`${DOWN}${DOWN}${CONFIRM}`),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        const { dependencies } = JSON.parse(await readFile(`${builder.directory}/package.json`, 'utf-8'))

        // NOTE: Ideally we should be running this test with a specific template,
        // but `inquirer-autocomplete-prompt` doesn't seem to work with the way
        // we're mocking prompt responses with `handleQuestions`. Instead, we're
        // choosing the second template in the list, assuming it's the first one
        // that contains a `package.json` (currently that's `apollo-graphql`).
        expect(await fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/apollo-graphql.js`)).toBe(true)
        expect(await fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/package.json`)).toBe(false)
        expect(typeof dependencies['apollo-server-lambda']).toBe('string')

        expect(dependencies['@netlify/functions']).toBe('^0.1.0')
      })
    })
  })

  test('should install function template dependencies in the function sub-directory if no site-level `package.json` is found', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-no-functions-dir-without-package-json', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(`${DOWN}${CONFIRM}`),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Select the language of your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(`${DOWN}${DOWN}${CONFIRM}`),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        // NOTE: Ideally we should be running this test with a specific template,
        // but `inquirer-autocomplete-prompt` doesn't seem to work with the way
        // we're mocking prompt responses with `handleQuestions`. Instead, we're
        // choosing the second template in the list, assuming it's the first one
        // that contains a `package.json` (currently that's `apollo-graphql`).
        expect(await fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/apollo-graphql.js`)).toBe(true)
        expect(await fileExistsAsync(`${builder.directory}/test/functions/apollo-graphql/package.json`)).toBe(true)
      })
    })
  })

  test('should not create a new function directory when one is found', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-functions-dir', async (builder) => {
      builder.withNetlifyToml({ config: { build: { functions: 'functions' } } })

      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(`${DOWN}${CONFIRM}`),
        },
        {
          question: 'Select the language of your function',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['functions:create'], getCLIOptions({ apiUrl, builder }))

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/functions/hello-world/hello-world.js`)).toBe(true)
      })
    })
  })

  test('should only show function templates for the language specified via the --language flag, if one is present', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(`${DOWN}${CONFIRM}`),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(
          cliPath,
          ['functions:create', '--language', 'javascript'],
          getCLIOptions({ apiUrl, builder }),
        )

        handleQuestions(childProcess, createFunctionQuestions)

        await childProcess

        expect(await fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(true)
      })
    })
  })

  test('throws an error when the --language flag contains an unsupported value', async () => {
    const siteInfo = {
      admin_url: 'https://app.netlify.com/sites/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
    }

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'sites',
        response: [siteInfo],
      },
      { path: 'sites/site_id', method: 'patch', response: {} },
    ]

    await withSiteBuilder('site-with-no-functions-dir', async (builder) => {
      await builder.buildAsync()

      const createFunctionQuestions = [
        {
          question: "Select the type of function you'd like to create",
          answer: answerWithValue(`${DOWN}${CONFIRM}`),
        },
        {
          question: 'Enter the path, relative to your site',
          answer: answerWithValue('test/functions'),
        },
        {
          question: 'Pick a template',
          answer: answerWithValue(CONFIRM),
        },
        {
          question: 'Name your function',
          answer: answerWithValue(CONFIRM),
        },
      ]

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(
          cliPath,
          ['functions:create', '--language', 'coffeescript'],
          getCLIOptions({ apiUrl, builder }),
        )

        handleQuestions(childProcess, createFunctionQuestions)

        await expect(childProcess).rejects.toThrowError('Invalid language: coffeescript')

        expect(await fileExistsAsync(`${builder.directory}/test/functions/hello-world/hello-world.js`)).toBe(false)
      })
    })
  })
})
