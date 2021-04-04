const test = require('ava')
const execa = require('execa')
const toml = require('toml')

const { readFileAsync } = require('../src/lib/fs')

const cliPath = require('./utils/cli-path')
const { handleQuestions, answerWithValue, CONFIRM, DOWN } = require('./utils/handle-questions')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const assetSiteRequests = (
  t,
  requests,
  { command = 'custom-build-command', functions = 'custom-functions', publish = 'custom-publish', plugins = [] } = {},
) => {
  // assert updateSite was called with user inputs
  const siteUpdateRequests = requests
    .filter(({ path, method }) => path === '/api/v1/sites/site_id' && method === 'PATCH')
    .map(({ body }) => body)
  t.deepEqual(siteUpdateRequests, [
    {
      plugins,
      repo: {
        allowed_branches: ['main'],
        cmd: command,
        dir: publish,
        provider: 'manual',
        repo_branch: 'main',
        repo_path: 'git@github.com:owner/repo.git',
      },
    },
    {
      build_settings: {
        functions_dir: functions,
      },
    },
  ])
}

const assertSiteInit = async (
  t,
  builder,
  requests,
  { command = 'custom-build-command', functions = 'custom-functions', publish = 'custom-publish', plugins = [] } = {},
) => {
  // assert netlify.toml was created with user inputs
  const netlifyToml = toml.parse(await readFileAsync(`${builder.directory}/netlify.toml`, 'utf8'))
  t.deepEqual(netlifyToml, {
    build: { command, functions, publish },
  })

  assetSiteRequests(t, requests, { command, functions, publish, plugins })
}

test('netlify init existing site', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: CONFIRM,
    },
    {
      question: 'How do you want to link this folder to a site',
      answer: CONFIRM,
    },
    {
      question: 'Your build command (hugo build/yarn run build/etc)',
      answer: answerWithValue('custom-build-command'),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue('custom-publish'),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue('custom-functions'),
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
    { path: 'deploy_keys', method: 'post', response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'patch', response: { deploy_hook: 'deploy_hook' } },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    builder.withGit({ repoUrl: 'git@github.com:owner/repo.git' })

    await builder.buildAsync()
    await withMockApi(routes, async ({ apiUrl, requests }) => {
      // --force is required since we return an existing site in the `sites` route
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--force', '--manual'], {
        cwd: builder.directory,
        // NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required for @netlify/config to retrieve site info
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_SITE_ID: 'site_id', NETLIFY_AUTH_TOKEN: 'fake-token' },
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertSiteInit(t, builder, requests)
    })
  })
})

test('netlify init new site', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Your build command (hugo build/yarn run build/etc)',
      answer: answerWithValue('custom-build-command'),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue('custom-publish'),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue('custom-functions'),
    },
    {
      question: 'No netlify.toml detected',
      answer: CONFIRM,
    },
    { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
    { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
    { question: 'Configure the following webhook for your repository', answer: CONFIRM },
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
      path: 'user',
      response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
    },
    {
      path: 'test-account/sites',
      method: 'post',
      response: { id: 'site_id', name: 'test-site-name' },
    },
    { path: 'deploy_keys', method: 'post', response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'patch', response: { deploy_hook: 'deploy_hook' } },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    builder.withGit({ repoUrl: 'git@github.com:owner/repo.git' })

    await builder.buildAsync()
    await withMockApi(routes, async ({ apiUrl, requests }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: builder.directory,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        encoding: 'utf8',
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertSiteInit(t, builder, requests)
    })
  })
})

test('netlify init new Next.js site', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Your build command (hugo build/yarn run build/etc)',
      answer: answerWithValue('custom-build-command'),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue('custom-publish'),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue('custom-functions'),
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
      path: 'user',
      response: { name: 'test user', slug: 'test-user', email: 'user@test.com' },
    },
    {
      path: 'test-account/sites',
      method: 'post',
      response: { id: 'site_id', name: 'test-site-name' },
    },
    { path: 'deploy_keys', method: 'post', response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'patch', response: { deploy_hook: 'deploy_hook' } },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    builder
      .withGit({ repoUrl: 'git@github.com:owner/repo.git' })
      .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })

    await builder.buildAsync()
    await withMockApi(routes, async ({ apiUrl, requests }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: builder.directory,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertSiteInit(t, builder, requests, { plugins: [{ package: '@netlify/plugin-nextjs' }] })
    })
  })
})

test('netlify init existing Next.js site with existing plugins', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: CONFIRM,
    },
    {
      question: 'How do you want to link this folder to a site',
      answer: CONFIRM,
    },
    {
      question: 'Your build command (hugo build/yarn run build/etc)',
      answer: answerWithValue('custom-build-command'),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue('custom-publish'),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue('custom-functions'),
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
    admin_url: 'https://app.netlify.com/sites/site-name/overview',
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
    { path: 'deploy_keys', method: 'post', response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'patch', response: { deploy_hook: 'deploy_hook' } },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    builder
      .withGit({ repoUrl: 'git@github.com:owner/repo.git' })
      .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })

    await builder.buildAsync()
    await withMockApi(routes, async ({ apiUrl, requests }) => {
      // --force is required since we return an existing site in the `sites` route
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--force', '--manual'], {
        cwd: builder.directory,
        // NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN are required for @netlify/config to retrieve site info
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_SITE_ID: 'site_id', NETLIFY_AUTH_TOKEN: 'fake-token' },
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      assetSiteRequests(t, requests, {
        plugins: [{ package: '@netlify/plugin-lighthouse' }, { package: '@netlify/plugin-nextjs' }],
      })
    })
  })
})
