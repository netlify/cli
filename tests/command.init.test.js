const { Buffer } = require('buffer')

const test = require('ava')
const execa = require('execa')
const toml = require('toml')

const { readFileAsync } = require('../src/lib/fs')

const cliPath = require('./utils/cli-path')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const handleQuestions = (process, questions) => {
  const remainingQuestions = [...questions]
  let buffer = ''
  process.stdout.on('data', (data) => {
    buffer += data
    const index = remainingQuestions.findIndex(({ question }) => buffer.includes(question))
    if (index >= 0) {
      buffer = ''
      process.stdin.write(Buffer.from(remainingQuestions[index].answer))
      remainingQuestions.splice(index, 1)
    }
  })
}

const CONFIRM = '\n'
const DOWN = '\u001B[B'
const answerWithValue = (value) => `${value}${CONFIRM}`

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
    ...(plugins.length === 0 ? {} : { plugins }),
  })

  // assert updateSite was called with user inputs
  const siteUpdateRequests = requests.filter(({ path }) => path === '/api/v1/sites/site_id').map(({ body }) => body)
  t.deepEqual(siteUpdateRequests, [
    {
      plugins,
      repo: {
        allowed_branches: ['master'],
        cmd: command,
        dir: publish,
        provider: 'manual',
        repo_branch: 'master',
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

  const routes = [
    {
      path: 'sites',
      response: [
        {
          admin_url: 'https://app.netlify.com/sites/site-name/overview',
          ssl_url: 'https://site-name.netlify.app/',
          id: 'site_id',
          name: 'site-name',
          build_settings: { repo_url: 'https://github.com/owner/repo' },
        },
      ],
    },
    { path: 'deploy_keys', method: 'post', response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'patch', response: { deploy_hook: 'deploy_hook' } },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    builder.withGit({ repoUrl: 'git@github.com:owner/repo.git' })

    await builder.buildAsync()
    await withMockApi(routes, async ({ apiUrl, requests }) => {
      // --force is required since we we return an existing site in the `sites` route
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--force', '--manual'], {
        cwd: builder.directory,
        env: { NETLIFY_API_URL: apiUrl },
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
        env: { NETLIFY_API_URL: apiUrl },
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
      question: 'Install Next on Netlify plugin',
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
        env: { NETLIFY_API_URL: apiUrl },
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertSiteInit(t, builder, requests, { plugins: [{ package: '@netlify/plugin-nextjs' }] })
    })
  })
})
