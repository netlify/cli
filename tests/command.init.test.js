const test = require('ava')
const cleanDeep = require('clean-deep')
const execa = require('execa')
const toml = require('toml')

const { readFileAsync } = require('../src/lib/fs')

const cliPath = require('./utils/cli-path')
const { handleQuestions, answerWithValue, CONFIRM, DOWN } = require('./utils/handle-questions')
const { withMockApi } = require('./utils/mock-api')
const { withSiteBuilder } = require('./utils/site-builder')

const assertNetlifyToml = async (t, tomlDir, { command, functions, publish }) => {
  // assert netlify.toml was created with user inputs
  const netlifyToml = toml.parse(await readFileAsync(`${tomlDir}/netlify.toml`, 'utf8'))
  t.deepEqual(
    netlifyToml,
    cleanDeep({
      build: { command, functions, publish },
    }),
  )
}

test('netlify init existing site', async (t) => {
  const [command, publish, functions] = ['custom-build-command', 'custom-publish', 'custom-functions']
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
      answer: answerWithValue(command),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue(publish),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue(functions),
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
    {
      path: 'sites/site_id',
      method: 'patch',
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
          functions_dir: functions,
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder.withGit().buildAsync()

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

      await assertNetlifyToml(t, builder.directory, { command, functions, publish })
    })
  })
})

test('netlify init new site', async (t) => {
  const [command, publish, functions] = ['custom-build-command', 'custom-publish', 'custom-functions']
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Your build command (hugo build/yarn run build/etc)',
      answer: answerWithValue(command),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue(publish),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue(functions),
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
    {
      path: 'sites/site_id',
      method: 'patch',
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
          functions_dir: functions,
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder.withGit().buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: builder.directory,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        encoding: 'utf8',
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertNetlifyToml(t, builder.directory, { command, functions, publish })
    })
  })
})

test('netlify init new Next.js site', async (t) => {
  const [command, publish, functions] = ['custom-build-command', 'custom-publish', 'custom-functions']
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Your build command (hugo build/yarn run build/etc)',
      answer: answerWithValue(command),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue(publish),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue(functions),
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
    {
      path: 'sites/site_id',
      method: 'patch',
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
          functions_dir: functions,
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder
      .withGit()
      .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })
      .buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: builder.directory,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertNetlifyToml(t, builder.directory, { command, functions, publish })
    })
  })
})

test('netlify init existing Next.js site with existing plugins', async () => {
  const [command, publish, functions] = ['custom-build-command', 'custom-publish', 'custom-functions']
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
      answer: answerWithValue(command),
    },
    {
      question: 'Directory to deploy (blank for current dir)',
      answer: answerWithValue(publish),
    },
    {
      question: 'Netlify functions folder',
      answer: answerWithValue(functions),
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
    {
      path: 'sites/site_id',
      method: 'patch',
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
          functions_dir: functions,
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder
      .withGit()
      .withPackageJson({ packageJson: { dependencies: { next: '^10.0.0' } } })
      .buildAsync()

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

test('netlify init monorepo root and sub directory without netlify.toml', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Base directory (e.g. projects/frontend):',
      answer: CONFIRM,
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
      question: 'Netlify functions folder',
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
    {
      path: 'sites/site_id',
      method: 'patch',
      response: { deploy_hook: 'deploy_hook' },
      requestBody: {
        plugins: [],
        repo: {
          allowed_branches: ['main'],
          cmd: '# no build command',
          dir: '.',
          provider: 'manual',
          repo_branch: 'main',
          base: 'projects/project1',
          repo_path: 'git@github.com:owner/repo.git',
          functions_dir: 'netlify/functions',
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder
      .withContentFiles([
        {
          path: 'index.html',
          content: 'root',
        },
        {
          path: 'projects/project1/index.html',
          content: 'project1',
        },
        {
          path: 'projects/project2/index.html',
          content: 'project2',
        },
      ])
      .withGit()
      .buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: `${builder.directory}/projects/project1`,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        encoding: 'utf8',
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertNetlifyToml(t, `${builder.directory}/projects/project1`, {
        command: '# no build command',
        functions: 'netlify/functions',
        publish: '.',
      })
    })
  })
})

test('netlify init monorepo root with netlify.toml, subdirectory without netlify.toml', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Base directory (e.g. projects/frontend):',
      answer: CONFIRM,
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
      question: 'Netlify functions folder',
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
    {
      path: 'sites/site_id',
      method: 'patch',
      response: { deploy_hook: 'deploy_hook' },
      requestBody: {
        plugins: [],
        repo: {
          allowed_branches: ['main'],
          cmd: '# no build command',
          dir: '.',
          provider: 'manual',
          repo_branch: 'main',
          base: 'projects/project2',
          repo_path: 'git@github.com:owner/repo.git',
          functions_dir: 'netlify/functions',
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder
      .withNetlifyToml({ config: { build: {} } })
      .withContentFiles([
        {
          path: 'index.html',
          content: 'root',
        },
        {
          path: 'projects/project1/index.html',
          content: 'project1',
        },
        {
          path: 'projects/project2/index.html',
          content: 'project2',
        },
      ])
      .withGit()
      .buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: `${builder.directory}/projects/project2`,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        encoding: 'utf8',
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertNetlifyToml(t, `${builder.directory}/projects/project2`, {
        command: '# no build command',
        functions: 'netlify/functions',
        publish: '.',
      })
    })
  })
})

test('netlify init monorepo root and sub directory with netlify.toml', async (t) => {
  const initQuestions = [
    {
      question: 'Create & configure a new site',
      answer: answerWithValue(DOWN),
    },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
    {
      question: 'Base directory (e.g. projects/frontend):',
      answer: CONFIRM,
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
      question: 'Netlify functions folder',
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
    {
      path: 'sites/site_id',
      method: 'patch',
      response: { deploy_hook: 'deploy_hook' },
      requestBody: {
        plugins: [],
        repo: {
          allowed_branches: ['main'],
          cmd: 'echo "hello"',
          dir: '.',
          provider: 'manual',
          repo_branch: 'main',
          base: 'projects/project2',
          repo_path: 'git@github.com:owner/repo.git',
          functions_dir: 'netlify/functions',
        },
      },
    },
  ]

  await withSiteBuilder('new-site', async (builder) => {
    await builder
      .withNetlifyToml({ config: { build: {} } })
      .withNetlifyToml({ pathPrefix: 'projects/project2', config: { build: { command: 'echo "hello"' } } })
      .withContentFiles([
        {
          path: 'index.html',
          content: 'root',
        },
        {
          path: 'projects/project1/index.html',
          content: 'project1',
        },
        {
          path: 'projects/project2/index.html',
          content: 'project2',
        },
      ])
      .withGit()
      .buildAsync()

    await withMockApi(routes, async ({ apiUrl }) => {
      // --manual is used to avoid the config-github flow that uses GitHub API
      const childProcess = execa(cliPath, ['init', '--manual'], {
        cwd: `${builder.directory}/projects/project2`,
        env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        encoding: 'utf8',
      })

      handleQuestions(childProcess, initQuestions)

      await childProcess

      await assertNetlifyToml(t, `${builder.directory}/projects/project2`, {
        command: 'echo "hello"',
      })
    })
  })
})
