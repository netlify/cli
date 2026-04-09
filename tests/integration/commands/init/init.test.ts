import path from 'node:path'
import { readFile } from 'node:fs/promises'

import cleanDeep from 'clean-deep'
import execa from 'execa'
import toml from 'toml'
import { describe, test, type TestContext } from 'vitest'

import { cliPath } from '../../utils/cli-path.js'
import { CONFIRM, DOWN, answerWithValue, handleQuestions } from '../../utils/handle-questions.js'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const defaultFunctionsDirectory = 'netlify/functions'

const assertNetlifyToml = async (
  t: TestContext,
  tomlDir: string,
  { command, functions, publish }: { command: string; functions: string; publish: string },
) => {
  // assert netlify.toml was created with user inputs
  const netlifyToml: unknown = toml.parse(await readFile(path.join(tomlDir, '/netlify.toml'), 'utf8'))
  t.expect(netlifyToml).toEqual(
    // @ts-expect-error(ndhoule): Don't know what's wrong with this typedef
    cleanDeep({
      build: { command, functions, publish },
    }),
  )
}

describe.concurrent('commands/init', () => {
  test('netlify init existing project', async (t) => {
    const [command, publish] = ['custom-build-command', 'custom-publish']
    const initQuestions = [
      {
        question: 'Create & configure a new project',
        answer: CONFIRM,
      },
      {
        question: 'How do you want to link this folder to a project',
        answer: CONFIRM,
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: answerWithValue(command),
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: answerWithValue(publish),
      },
      {
        question: 'No netlify.toml detected',
        answer: CONFIRM,
      },
      { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
      { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
      { question: 'Configure the following webhook for your repository', answer: CONFIRM },
    ]

    const siteInfo = {
      admin_url: 'https://app.netlify.com/projects/site-name/overview',
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
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      {
        path: 'sites/site_id',
        method: 'PATCH' as const,
        response: { deploy_hook: 'deploy_hook' },
        requestBody: {
          plugins: [],
          repo: {
            allowed_branches: ['main'],
            cmd: command,
            dir: publish,
            provider: 'manual',
            repo_branch: 'main',
            repo_path: 'git@github.com:owner/repo.git',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --force is required since we return an existing site in the `sites` route
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--force', '--manual'], {
          cwd: builder.directory,
          // NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required for @netlify/config to retrieve site info
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_SITE_ID: 'site_id', NETLIFY_AUTH_TOKEN: 'fake-token' },
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess

        await assertNetlifyToml(t, builder.directory, { command, functions: defaultFunctionsDirectory, publish })
      })
    })
  })

  test('netlify init new project', async (t) => {
    const [command, publish] = ['custom-build-command', 'custom-publish']
    const initQuestions = [
      {
        question: 'Create & configure a new project',
        answer: answerWithValue(DOWN),
      },
      { question: 'Team: (Use arrow keys)', answer: CONFIRM },
      {
        question: 'Project name (leave blank for a random name; you can change it later)',
        answer: answerWithValue('test-site-name'),
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: answerWithValue(command),
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: answerWithValue(publish),
      },
      {
        question: 'No netlify.toml detected. Would you like to create one with these build settings?',
        answer: CONFIRM,
      },
      { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
      { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
      { question: 'Configure the following webhook for your repository', answer: CONFIRM },
    ]

    const siteInfo = {
      admin_url: 'https://app.netlify.com/projects/site-name/overview',
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
      {
        path: 'sites',
        response: [],
      },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'user',
        response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
      },
      {
        path: 'test-account/sites',
        method: 'POST' as const,
        response: { id: 'site_id', name: 'test-site-name' },
      },
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      {
        path: 'sites/site_id',
        method: 'PATCH' as const,
        response: { deploy_hook: 'deploy_hook' },
        requestBody: {
          plugins: [],
          repo: {
            allowed_branches: ['main'],
            cmd: command,
            dir: publish,
            provider: 'manual',
            repo_branch: 'main',
            repo_path: 'git@github.com:owner/repo.git',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--manual'], {
          cwd: builder.directory,
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
          encoding: 'utf8',
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess

        await assertNetlifyToml(t, builder.directory, { command, functions: defaultFunctionsDirectory, publish })
      })
    })
  })

  test('prompts to configure build settings when no git remote is found', async (t) => {
    const publish = 'custom-publish'
    const initQuestions = [
      {
        question: 'Yes, create and deploy project manually',
        answer: CONFIRM, // List selection only needs one CONFIRM, not answerWithValue
      },
      { question: 'Team: (Use arrow keys)', answer: CONFIRM },
      {
        question: 'Project name (leave blank for a random name; you can change it later)',
        answer: answerWithValue('test-site-name'),
      },
      {
        question: `Do you want to configure build settings? We'll suggest settings for your project automatically`,
        answer: CONFIRM, // Confirm prompt only needs one CONFIRM
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: CONFIRM,
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: answerWithValue(publish),
      },
      {
        question: 'No netlify.toml detected. Would you like to create one with these build settings?',
        answer: CONFIRM,
      },
    ]

    const routes = [
      {
        path: 'accounts',
        response: [{ slug: 'test-account' }],
      },
      {
        path: 'sites',
        response: [],
      },
      {
        path: 'sites/site_id',
        response: {
          admin_url: 'https://app.netlify.com/projects/site-name/overview',
          ssl_url: 'https://site-name.netlify.app/',
          id: 'site_id',
          name: 'site-name',
          build_settings: {},
        },
      },
      {
        path: 'user',
        response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
      },
      {
        path: 'test-account/sites',
        method: 'POST' as const,
        response: { id: 'site_id', name: 'test-site-name' },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(routes, async ({ apiUrl }) => {
        const childProcess = execa(cliPath, ['init'], {
          cwd: builder.directory,
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
          encoding: 'utf8',
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess

        await assertNetlifyToml(t, builder.directory, {
          command: '# no build command',
          functions: defaultFunctionsDirectory,
          publish,
        })
      })
    })
  })

  test('netlify init new Next.js project', async (t) => {
    const [command, publish] = ['custom-build-command', 'custom-publish']
    const initQuestions = [
      {
        question: 'Create & configure a new project',
        answer: answerWithValue(DOWN),
      },
      { question: 'Team: (Use arrow keys)', answer: CONFIRM },
      {
        question: 'Project name (leave blank for a random name; you can change it later)',
        answer: answerWithValue('test-site-name'),
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: answerWithValue(command),
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: answerWithValue(publish),
      },
      {
        question: 'OK to install',
        answer: CONFIRM,
      },
      {
        question: 'No netlify.toml detected',
        answer: CONFIRM,
      },
      { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
      { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
      { question: 'Configure the following webhook for your repository', answer: CONFIRM },
    ]

    const siteInfo = {
      admin_url: 'https://app.netlify.com/projects/site-name/overview',
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

      {
        path: 'sites',
        response: [],
      },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'user',
        response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
      },
      {
        path: 'test-account/sites',
        method: 'POST' as const,
        response: { id: 'site_id', name: 'test-site-name' },
      },
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      {
        path: 'sites/site_id',
        method: 'PATCH' as const,
        response: { deploy_hook: 'deploy_hook' },
        requestBody: {
          plugins: [{ package: '@netlify/plugin-nextjs' }],
          repo: {
            allowed_branches: ['main'],
            cmd: command,
            dir: publish,
            provider: 'manual',
            repo_branch: 'main',
            repo_path: 'git@github.com:owner/repo.git',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withGit()
        .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--manual'], {
          cwd: builder.directory,
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        })

        handleQuestions(childProcess, initQuestions)

        const { stdout } = await childProcess

        t.expect(stdout).toContain("We detected that you're using Next.js. Below are recommended build settings.")

        await assertNetlifyToml(t, builder.directory, { command, functions: defaultFunctionsDirectory, publish })
      })
    })
  })

  test('netlify init new Next.js project with correct default build directory and build command', async (t) => {
    const [command, publish] = ['next build', '.next']
    const initQuestions = [
      {
        question: 'Create & configure a new project',
        answer: answerWithValue(DOWN),
      },
      { question: 'Team: (Use arrow keys)', answer: CONFIRM },
      {
        question: 'Project name (leave blank for a random name; you can change it later)',
        answer: answerWithValue('test-site-name'),
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: CONFIRM,
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: CONFIRM,
      },
      {
        question: 'OK to install',
        answer: CONFIRM,
      },
      {
        question: 'No netlify.toml detected',
        answer: CONFIRM,
      },
      { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
      { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
      { question: 'Configure the following webhook for your repository', answer: CONFIRM },
    ]

    const siteInfo = {
      admin_url: 'https://app.netlify.com/projects/site-name/overview',
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

      {
        path: 'sites',
        response: [],
      },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'user',
        response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
      },
      {
        path: 'test-account/sites',
        method: 'POST' as const,
        response: { id: 'site_id', name: 'test-site-name' },
      },
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      {
        path: 'sites/site_id',
        method: 'PATCH' as const,
        response: { deploy_hook: 'deploy_hook' },
        requestBody: {
          plugins: [{ package: '@netlify/plugin-nextjs' }],
          repo: {
            allowed_branches: ['main'],
            cmd: command,
            dir: publish,
            provider: 'manual',
            repo_branch: 'main',
            repo_path: 'git@github.com:owner/repo.git',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withGit()
        .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--manual'], {
          cwd: builder.directory,
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess

        await assertNetlifyToml(t, builder.directory, { command, functions: defaultFunctionsDirectory, publish })
      })
    })
  })

  // eslint-disable-next-line vitest/expect-expect
  test('netlify init existing Next.js project with existing plugins', async (t) => {
    const [command, publish] = ['custom-build-command', 'custom-publish', 'custom-functions']
    const initQuestions = [
      {
        question: 'Create & configure a new project',
        answer: CONFIRM,
      },
      {
        question: 'How do you want to link this folder to a project',
        answer: CONFIRM,
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: answerWithValue(command),
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: answerWithValue(publish),
      },
      {
        question: 'OK to install',
        answer: CONFIRM,
      },
      { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
      { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
      { question: 'Configure the following webhook for your repository', answer: CONFIRM },
    ]

    const siteInfo = {
      admin_url: 'https://app.netlify.com/projects/site-name/overview',
      ssl_url: 'https://site-name.netlify.app/',
      id: 'site_id',
      name: 'site-name',
      build_settings: { repo_url: 'https://github.com/owner/repo' },
      plugins: [{ package: '@netlify/plugin-lighthouse' }],
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
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      {
        path: 'sites/site_id',
        method: 'PATCH' as const,
        response: { deploy_hook: 'deploy_hook' },
        requestBody: {
          plugins: [{ package: '@netlify/plugin-lighthouse' }, { package: '@netlify/plugin-nextjs' }],
          repo: {
            allowed_branches: ['main'],
            cmd: command,
            dir: publish,
            provider: 'manual',
            repo_branch: 'main',
            repo_path: 'git@github.com:owner/repo.git',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withGit()
        .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --force is required since we return an existing site in the `sites` route
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--force', '--manual'], {
          cwd: builder.directory,
          // NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required for @netlify/config to retrieve site info
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_SITE_ID: 'site_id', NETLIFY_AUTH_TOKEN: 'fake-token' },
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess
      })
    })
  })

  test('netlify init new Gatsby project with correct default build directory and build command', async (t) => {
    const [command, publish] = ['gatsby build', 'public']
    const initQuestions = [
      {
        question: 'Create & configure a new project',
        answer: answerWithValue(DOWN),
      },
      { question: 'Team: (Use arrow keys)', answer: CONFIRM },
      {
        question: 'Project name (leave blank for a random name; you can change it later)',
        answer: answerWithValue('test-site-name'),
      },
      {
        question: 'Your build command (hugo build/yarn run build/etc)',
        answer: CONFIRM,
      },
      {
        question: 'Directory to deploy (blank for current dir)',
        answer: CONFIRM,
      },
      {
        question: 'OK to install',
        answer: CONFIRM,
      },
      {
        question: 'No netlify.toml detected',
        answer: CONFIRM,
      },
      { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
      { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
      { question: 'Configure the following webhook for your repository', answer: CONFIRM },
    ]

    const siteInfo = {
      admin_url: 'https://app.netlify.com/projects/site-name/overview',
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

      {
        path: 'sites',
        response: [],
      },
      { path: 'sites/site_id', response: siteInfo },
      {
        path: 'user',
        response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
      },
      {
        path: 'test-account/sites',
        method: 'POST' as const,
        response: { id: 'site_id', name: 'test-site-name' },
      },
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      {
        path: 'sites/site_id',
        method: 'PATCH' as const,
        response: { deploy_hook: 'deploy_hook' },
        requestBody: {
          plugins: [{ package: '@netlify/plugin-gatsby' }],
          repo: {
            allowed_branches: ['main'],
            cmd: command,
            dir: publish,
            provider: 'manual',
            repo_branch: 'main',
            repo_path: 'git@github.com:owner/repo.git',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder
        .withGit()
        .withContentFile({
          content: '',
          path: 'gatsby-config.js',
        })
        .withPackageJson({ packageJson: { dependencies: { gatsby: '4.11.0' } } })
        .build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--manual'], {
          cwd: builder.directory,
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess

        await assertNetlifyToml(t, builder.directory, { command, functions: defaultFunctionsDirectory, publish })
      })
    })
  })
})
