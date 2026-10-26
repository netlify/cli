import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'

import cleanDeep from 'clean-deep'
import execa from 'execa'
import toml from 'toml'
import { describe, test, type TestContext } from 'vitest'

import { cliPath } from '../../utils/cli-path.js'
import { CONFIRM, DOWN, NO, answerWithValue, handleQuestions } from '../../utils/handle-questions.js'
import { withMockApi } from '../../utils/mock-api.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

const defaultFunctionsDirectory = 'netlify/functions'

const SKILL_CONTENT = '# netlify-functions\n'

const sha256 = (content: string) => `sha256:${createHash('sha256').update(content).digest('hex')}`

type SkillFiles = Record<string, string>

const treeHashOf = (files: SkillFiles) => {
  const hash = createHash('sha256')
  for (const file of Object.keys(files).sort()) {
    hash.update(`${file}\u0000100644\u0000${sha256(files[file]).replace(/^sha256:/, '')}\n`)
  }
  return `sha256:${hash.digest('hex')}`
}

interface HostedSkill {
  files: SkillFiles
  status?: 'active' | 'deprecated'
  previous?: Record<string, SkillFiles>
}

const DEFAULT_HOSTED_SKILLS: Record<string, HostedSkill> = {
  'netlify-functions': { files: { 'SKILL.md': SKILL_CONTENT } },
}

const skillsManifest = (skills: Record<string, HostedSkill>) => ({
  schema_version: 1,
  version: '1.0.0',
  skills: Object.entries(skills).map(([name, { files, status = 'active', previous = {} }]) => {
    const current = status === 'active' ? treeHashOf(files) : null
    return {
      name,
      status,
      version: current ? '1.0.0' : null,
      prior_names: [],
      description: name,
      tree_hash: current,
      files: Object.fromEntries(Object.entries(files).map(([file, content]) => [file, sha256(content)])),
      executable: [],
      history: [
        ...Object.entries(previous).map(([version, oldFiles]) => ({ version, tree_hash: treeHashOf(oldFiles) })),
        ...(current ? [{ version: '1.0.0', tree_hash: current }] : []),
      ],
    }
  }),
})

const withSkillsHost = async (
  handler: (host: { url: string; requests: string[] }) => Promise<void>,
  skills: Record<string, HostedSkill> = DEFAULT_HOSTED_SKILLS,
) => {
  const requests: string[] = []
  const responses = new Map<string, string>([['/manifest.json', JSON.stringify(skillsManifest(skills))]])
  for (const [name, { files }] of Object.entries(skills)) {
    for (const [file, content] of Object.entries(files)) {
      responses.set(`/skills/${name}/${file}`, content)
    }
  }
  const server = createServer((req, res) => {
    const url = req.url ?? ''
    requests.push(url)
    const body = responses.get(url)
    res.statusCode = body === undefined ? 404 : 200
    res.end(body ?? 'not found')
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address() as AddressInfo
  try {
    await handler({ url: `http://127.0.0.1:${port.toString()}`, requests })
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
  }
}

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
            provider: 'github',
            repo_branch: 'main',
            repo_path: 'owner/repo',
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
        const childProcess = execa(cliPath, ['init', '--force', '--manual', '--skip-agent-setup'], {
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
      { question: 'Team:', answer: CONFIRM },
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
            provider: 'github',
            repo_branch: 'main',
            repo_path: 'owner/repo',
            functions_dir: defaultFunctionsDirectory,
          },
        },
      },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().build()

      await withMockApi(routes, async ({ apiUrl }) => {
        // --manual is used to avoid the config-github flow that uses GitHub API
        const childProcess = execa(cliPath, ['init', '--manual', '--skip-agent-setup'], {
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
      { question: 'Team:', answer: CONFIRM },
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
        const childProcess = execa(cliPath, ['init', '--skip-agent-setup'], {
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
      { question: 'Team:', answer: CONFIRM },
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
            provider: 'github',
            repo_branch: 'main',
            repo_path: 'owner/repo',
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
        const childProcess = execa(cliPath, ['init', '--manual', '--skip-agent-setup'], {
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
      { question: 'Team:', answer: CONFIRM },
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
            provider: 'github',
            repo_branch: 'main',
            repo_path: 'owner/repo',
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
        const childProcess = execa(cliPath, ['init', '--manual', '--skip-agent-setup'], {
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
            provider: 'github',
            repo_branch: 'main',
            repo_path: 'owner/repo',
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
        const childProcess = execa(cliPath, ['init', '--force', '--manual', '--skip-agent-setup'], {
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
      { question: 'Team:', answer: CONFIRM },
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
            provider: 'github',
            repo_branch: 'main',
            repo_path: 'owner/repo',
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
        const childProcess = execa(cliPath, ['init', '--manual', '--skip-agent-setup'], {
          cwd: builder.directory,
          env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
        })

        handleQuestions(childProcess, initQuestions)

        await childProcess

        await assertNetlifyToml(t, builder.directory, { command, functions: defaultFunctionsDirectory, publish })
      })
    })
  })

  const linkedSiteInfo = {
    admin_url: 'https://app.netlify.com/projects/site-name/overview',
    ssl_url: 'https://site-name.netlify.app/',
    id: 'site_id',
    name: 'site-name',
    build_settings: { repo_url: 'https://github.com/owner/repo' },
  }
  const linkedSiteRoutes = [
    { path: 'accounts', response: [{ slug: 'test-account' }] },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'sites/site_id', response: linkedSiteInfo },
    { path: 'sites', response: [linkedSiteInfo] },
    { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
    { path: 'sites/site_id', method: 'PATCH' as const, response: { deploy_hook: 'deploy_hook' } },
  ]
  const manualQuestions = () => [
    { question: 'Your build command (hugo build/yarn run build/etc)', answer: answerWithValue('npm run build') },
    { question: 'Directory to deploy (blank for current dir)', answer: answerWithValue('dist') },
    { question: 'No netlify.toml detected', answer: CONFIRM },
    { question: 'Give this Netlify SSH public key access to your repository', answer: CONFIRM },
    { question: 'The SSH URL of the remote git repo', answer: CONFIRM },
    { question: 'Configure the following webhook for your repository', answer: CONFIRM },
  ]
  const initOnLinkedSite =
    ({ apiUrl, cwd, skillsHost }: { apiUrl: string; cwd: string; skillsHost: string }) =>
    async (...flags: string[]) => {
      const env = {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_SITE_ID: 'site_id',
        NETLIFY_AUTH_TOKEN: 'fake-token',
        NETLIFY_SKILLS_HOST: skillsHost,
      }
      const childProcess = execa(cliPath, ['init', '--manual', ...flags], { cwd, env })
      if (process.env.DEBUG_TESTS) {
        childProcess.stdout?.on('data', (data: Buffer) => {
          process.stderr.write(data)
        })
      }
      handleQuestions(childProcess, manualQuestions())
      return await childProcess
    }

  test('netlify init installs Netlify skills for AI agents by default and is idempotent', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().ensureDirectoryExists(path.join(builder.directory, '.agents')).build()

      await withMockApi(linkedSiteRoutes, async ({ apiUrl }) => {
        await withSkillsHost(async (skillsHost) => {
          const skillPath = path.join(builder.directory, '.agents', 'skills', 'netlify-functions', 'SKILL.md')
          const runInit = initOnLinkedSite({ apiUrl, cwd: builder.directory, skillsHost: skillsHost.url })

          const first = await runInit()
          t.expect(first.stdout).toContain('Installed Netlify skills')
          await t.expect(readFile(skillPath, 'utf8')).resolves.toBe(SKILL_CONTENT)
          const requestsAfterFirstRun = skillsHost.requests.length

          const second = await runInit()
          t.expect(second.stdout).toContain('are up to date')
          t.expect(skillsHost.requests.slice(requestsAfterFirstRun)).toEqual(['/manifest.json'])
          await t.expect(readFile(skillPath, 'utf8')).resolves.toBe(SKILL_CONTENT)

          const skipped = await runInit('--skip-agent-setup')
          t.expect(skipped.stdout).not.toContain('Netlify skills')
          t.expect(skillsHost.requests.length).toBe(requestsAfterFirstRun + 1)
        })
      })
    })
  })

  test('netlify init syncs installed skills: updates stale copies, removes deprecated ones, keeps edits until --reset-context', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      const skillsDir = path.join('.agents', 'skills')
      await builder
        .withGit()
        .withContentFiles([
          { path: path.join(skillsDir, 'netlify-functions', 'SKILL.md'), content: '# functions (old)\n' },
          { path: path.join(skillsDir, 'netlify-blobs', 'SKILL.md'), content: '# blobs plus my notes\n' },
          { path: path.join(skillsDir, 'netlify-db', 'SKILL.md'), content: '# db\n' },
        ])
        .build()
      const skillFile = (name: string) => readFile(path.join(builder.directory, skillsDir, name, 'SKILL.md'), 'utf8')

      await withMockApi(linkedSiteRoutes, async ({ apiUrl }) => {
        await withSkillsHost(
          async (skillsHost) => {
            const runInit = initOnLinkedSite({ apiUrl, cwd: builder.directory, skillsHost: skillsHost.url })

            const first = await runInit()
            t.expect(first.stdout).toMatch(/Synced Netlify skills in .*\(1 updated, 1 removed, 1 kept\)\./)
            t.expect(first.stdout).toContain('netlify-blobs: edited locally')
            t.expect(first.stdout).toContain('--reset-context')
            await t.expect(skillFile('netlify-functions')).resolves.toBe('# functions\n')
            await t.expect(skillFile('netlify-blobs')).resolves.toBe('# blobs plus my notes\n')
            await t.expect(skillFile('netlify-db')).rejects.toThrow(/ENOENT/)

            const second = await runInit('--reset-context')
            t.expect(second.stdout).toMatch(/Synced Netlify skills in .*\(1 reset\)\./)
            await t.expect(skillFile('netlify-blobs')).resolves.toBe('# blobs\n')
          },
          {
            'netlify-functions': {
              files: { 'SKILL.md': '# functions\n' },
              previous: { '0.9.0': { 'SKILL.md': '# functions (old)\n' } },
            },
            'netlify-blobs': { files: { 'SKILL.md': '# blobs\n' } },
            'netlify-db': { files: {}, status: 'deprecated', previous: { '0.9.0': { 'SKILL.md': '# db\n' } } },
          },
        )
      })
    })
  })

  const NO_GIT_PROMPT = 'Do you want to create a Netlify project without a git repository?'
  const manualSiteInfo = {
    admin_url: 'https://app.netlify.com/projects/test-site-name/overview',
    ssl_url: 'https://test-site-name.netlify.app/',
    id: 'site_id',
    name: 'test-site-name',
    build_settings: {},
  }
  const createWithoutGitQuestions = () => [
    { question: 'Yes, create and deploy project manually', answer: CONFIRM },
    { question: 'Team:', answer: CONFIRM },
    {
      question: 'Project name (leave blank for a random name; you can change it later)',
      answer: answerWithValue('test-site-name'),
    },
    { question: 'Do you want to configure build settings?', answer: answerWithValue(NO) },
  ]
  const noGitRoutes = [
    { path: 'accounts', response: [{ slug: 'test-account' }] },
    { path: 'sites', response: [] },
    { path: 'sites/site_id/service-instances', response: [] },
    { path: 'sites/site_id', response: manualSiteInfo },
    { path: 'user', response: { name: 'test user', slug: 'test-user', email: 'user@test.com' } },
    { path: 'test-account/sites', method: 'POST' as const, response: { id: 'site_id', name: 'test-site-name' } },
  ]
  const deletedSiteRoute = { path: 'sites/deleted_site_id', status: 404, response: { message: 'Not Found' } }
  const countSiteCreations = (requests: { method: string; path: string }[]) =>
    requests.filter(({ method, path: requestPath }) => method === 'POST' && requestPath.endsWith('/test-account/sites'))
      .length
  const runInitIn = (
    cwd: string,
    apiUrl: string,
    questions: { question: string; answer: string | string[] }[],
    flags: string[] = [],
  ) => {
    const childProcess = execa(cliPath, ['init', '--manual', '--skip-agent-setup', ...flags], {
      cwd,
      env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
      encoding: 'utf8',
    })
    handleQuestions(childProcess, questions)
    return childProcess
  }
  const readStateSiteId = async (cwd: string) =>
    (JSON.parse(await readFile(path.join(cwd, '.netlify', 'state.json'), 'utf8')) as { siteId?: string }).siteId

  test('rerunning netlify init in a folder linked without git does not create another project', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.build()

      await withMockApi(noGitRoutes, async ({ apiUrl, requests }) => {
        const first = await runInitIn(builder.directory, apiUrl, createWithoutGitQuestions())
        t.expect(first.stdout).toContain(NO_GIT_PROMPT)
        t.expect(countSiteCreations(requests)).toBe(1)
        await t.expect(readStateSiteId(builder.directory)).resolves.toBe('site_id')

        const second = await runInitIn(builder.directory, apiUrl, createWithoutGitQuestions())
        t.expect(second.stdout).not.toContain(NO_GIT_PROMPT)
        t.expect(second.stdout).toContain('This folder is already linked to the Netlify project test-site-name')
        t.expect(second.stdout).toContain('https://test-site-name.netlify.app/')
        t.expect(second.stdout).toMatch(/To deploy to this project, run (npx )?netlify deploy\./)
        t.expect(second.stdout).toMatch(
          /To link this folder to a different project, run (npx )?netlify unlink, then (npx )?netlify init\./,
        )
        t.expect(`${second.stdout}${second.stderr}`).not.toContain('Could not read the git remote')
        t.expect(countSiteCreations(requests)).toBe(1)
        await t.expect(readStateSiteId(builder.directory)).resolves.toBe('site_id')
      })
    })
  })

  test('netlify init on a linked project reports a git remote it cannot read', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().withStateFile({ siteId: 'site_id' }).build()

      await withMockApi(noGitRoutes, async ({ apiUrl, requests }) => {
        const { stdout, stderr } = await runInitIn(builder.directory, apiUrl, createWithoutGitQuestions(), [
          '--git-remote-name',
          'upstream',
        ])

        t.expect(`${stdout}${stderr}`).toContain(
          'Could not read the git remote: The specified remote "upstream" is not defined in Git repo',
        )
        t.expect(stdout).toContain('This folder is already linked to the Netlify project test-site-name')
        t.expect(stdout).not.toContain(NO_GIT_PROMPT)
        t.expect(countSiteCreations(requests)).toBe(0)
      })
    })
  })

  test('netlify init with a git remote replaces a deleted project link with a new project', async (t) => {
    const routes = [
      deletedSiteRoute,
      ...noGitRoutes,
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      { path: 'sites/site_id', method: 'PATCH' as const, response: { deploy_hook: 'deploy_hook' } },
    ]
    const questions = [
      { question: 'Create & configure a new project', answer: answerWithValue(DOWN) },
      { question: 'Team:', answer: CONFIRM },
      {
        question: 'Project name (leave blank for a random name; you can change it later)',
        answer: answerWithValue('test-site-name'),
      },
      ...manualQuestions(),
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().withStateFile({ siteId: 'deleted_site_id' }).build()

      await withMockApi(
        routes,
        async ({ apiUrl, requests }) => {
          const { stdout } = await runInitIn(builder.directory, apiUrl, questions)

          t.expect(stdout).not.toContain('already linked')
          t.expect(countSiteCreations(requests)).toBe(1)
          const patchedPaths = requests
            .filter(({ method }) => method === 'PATCH')
            .map(({ path: requestPath }) => requestPath)
          t.expect(patchedPaths).toEqual(['/api/v1/sites/site_id'])
          await t.expect(readStateSiteId(builder.directory)).resolves.toBe('site_id')
        },
        true,
      )
    })
  })

  test('netlify init keeps a deleted project link until a new project is saved', async (t) => {
    const existingSiteInfo = { ...manualSiteInfo, build_settings: { repo_url: 'https://github.com/owner/repo' } }
    const routes = [
      deletedSiteRoute,
      { path: 'accounts', response: [{ slug: 'test-account' }] },
      { path: 'sites', response: [existingSiteInfo] },
      { path: 'sites/site_id/service-instances', response: [] },
      { path: 'sites/site_id', response: existingSiteInfo },
    ]
    const questions = [
      { question: 'Connect this directory to an existing Netlify project', answer: CONFIRM },
      { question: 'How do you want to link this folder to a project?', answer: CONFIRM },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().withStateFile({ siteId: 'deleted_site_id' }).build()

      await withMockApi(
        routes,
        async ({ apiUrl, requests }) => {
          const result = await runInitIn(builder.directory, apiUrl, questions).catch(
            (error: unknown) => error as { exitCode: number; stdout: string; stderr: string },
          )

          t.expect(result.stdout).not.toContain('already linked')
          t.expect(result.stderr).toContain('No project specified. In non-interactive mode')
          t.expect(countSiteCreations(requests)).toBe(0)
          t.expect(requests.filter(({ method }) => method === 'PATCH')).toEqual([])
          await t.expect(readStateSiteId(builder.directory)).resolves.toBe('deleted_site_id')
        },
        true,
      )
    })
  })

  test('netlify init configures the repo when a project linked without git gets a git remote', async (t) => {
    const routes = [
      ...noGitRoutes,
      { path: 'deploy_keys', method: 'POST' as const, response: { public_key: 'public_key' } },
      { path: 'sites/site_id', method: 'PATCH' as const, response: { deploy_hook: 'deploy_hook' } },
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withGit().withStateFile({ siteId: 'site_id' }).build()

      await withMockApi(routes, async ({ apiUrl, requests }) => {
        const { stdout } = await runInitIn(builder.directory, apiUrl, manualQuestions())

        t.expect(stdout).not.toContain(NO_GIT_PROMPT)
        t.expect(stdout).not.toContain('already linked')
        t.expect(countSiteCreations(requests)).toBe(0)
        const patch = requests.find(
          ({ method, path: requestPath }) => method === 'PATCH' && requestPath.endsWith('/sites/site_id'),
        )
        t.expect(patch?.body).toMatchObject({ repo: { provider: 'github', repo_path: 'owner/repo' } })
      })
    })
  })

  test('netlify init ignores a linked project that no longer exists', async (t) => {
    await withSiteBuilder(t, async (builder) => {
      await builder.withStateFile({ siteId: 'deleted_site_id' }).build()

      await withMockApi(
        [deletedSiteRoute, ...noGitRoutes],
        async ({ apiUrl, requests }) => {
          const { stdout, stderr } = await runInitIn(builder.directory, apiUrl, createWithoutGitQuestions())

          t.expect(`${stdout}${stderr}`).toContain(
            'The Netlify project deleted_site_id linked to this folder no longer exists',
          )
          t.expect(stdout).not.toContain('already linked')
          t.expect(stdout).toContain(NO_GIT_PROMPT)
          t.expect(countSiteCreations(requests)).toBe(1)
          await t.expect(readStateSiteId(builder.directory)).resolves.toBe('site_id')
        },
        true,
      )
    })
  })

  test('netlify init ignores a linked project the user cannot access', async (t) => {
    const routes = [
      { path: 'sites/forbidden_site_id', status: 403, response: { message: 'Forbidden' } },
      ...noGitRoutes,
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withStateFile({ siteId: 'forbidden_site_id' }).build()

      await withMockApi(
        routes,
        async ({ apiUrl, requests }) => {
          const { stdout, stderr } = await runInitIn(builder.directory, apiUrl, createWithoutGitQuestions())

          t.expect(`${stdout}${stderr}`).toContain(
            "You don't have access to the Netlify project forbidden_site_id linked to this folder",
          )
          t.expect(stdout).not.toContain('already linked')
          t.expect(stdout).toContain(NO_GIT_PROMPT)
          t.expect(countSiteCreations(requests)).toBe(1)
          await t.expect(readStateSiteId(builder.directory)).resolves.toBe('site_id')
        },
        true,
      )
    })
  })

  test('netlify init stops without creating a project when the linked project cannot be loaded', async (t) => {
    const routes = [
      { path: 'sites/unavailable_site_id', status: 500, response: { message: 'Internal Server Error' } },
      ...noGitRoutes,
    ]

    await withSiteBuilder(t, async (builder) => {
      await builder.withStateFile({ siteId: 'unavailable_site_id' }).build()

      await withMockApi(
        routes,
        async ({ apiUrl, requests }) => {
          const result = await runInitIn(builder.directory, apiUrl, createWithoutGitQuestions()).catch(
            (error: unknown) => error as { exitCode: number; stdout: string; stderr: string },
          )

          t.expect(result.exitCode).not.toBe(0)
          t.expect(`${result.stdout}${result.stderr}`).toContain(
            'Could not load the Netlify project unavailable_site_id linked to this folder (status 500)',
          )
          t.expect(result.stdout).not.toContain(NO_GIT_PROMPT)
          t.expect(countSiteCreations(requests)).toBe(0)
          await t.expect(readStateSiteId(builder.directory)).resolves.toBe('unavailable_site_id')
        },
        true,
      )
    })
  })
})
