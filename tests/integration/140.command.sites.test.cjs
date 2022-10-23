const process = require('process')

const test = require('ava')
const inquirer = require('inquirer')
const prettyjson = require('prettyjson')
const sinon = require('sinon')

// Important to do the mocks before the code that uses it is required
// in this case the mocks have to be done before the createSitesFromTemplateCommand
// is required!
/* eslint-disable import/order */
const baseCommandPromise = import('../../src/commands/base-command.mjs')
const github = require('../../src/utils/init/config-github.cjs')
// mock the getGitHubToken method with a fake token
const gitMock = sinon.stub(github, 'getGitHubToken').callsFake(() => 'my-token')

const templatesUtils = require('../../src/utils/sites/utils.cjs')

const getTemplatesStub = sinon.stub(templatesUtils, 'getTemplatesFromGitHub').callsFake(() => [
  {
    name: 'next-starter',
    html_url: 'http://github.com/netlify-templates/next-starter',
    full_name: 'netlify-templates/next-starter',
  },
  {
    name: 'archived-starter',
    html_url: 'https://github.com/netlify-templates/fake-repo',
    full_name: 'netlify-templates/fake-repo',
    archived: true,
  },
])

const createRepoStub = sinon.stub(templatesUtils, 'createRepo').callsFake(() => ({
  full_name: 'Next starter',
  private: false,
  branch: 'main',
}))

const validateTemplateStub = sinon.stub(templatesUtils, 'validateTemplate').callsFake(() => ({
  exists: true,
  isTemplate: true,
}))

const jsonRenderSpy = sinon.spy(prettyjson, 'render')

const { createSitesFromTemplateCommand, fetchTemplates } = require('../../src/commands/sites/sites-create-template.cjs')
const { createSitesCreateCommand } = require('../../src/commands/sites/sites-create.cjs')

/* eslint-enable import/order */
const { withMockApi } = require('./utils/mock-api.cjs')

const inquirerStub = sinon.stub(inquirer, 'prompt').callsFake(() => Promise.resolve({ accountSlug: 'test-account' }))

test.beforeEach(() => {
  inquirerStub.resetHistory()
  gitMock.resetHistory()
  getTemplatesStub.resetHistory()
  createRepoStub.resetHistory()
  jsonRenderSpy.resetHistory()
  validateTemplateStub.resetHistory()
})

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
    method: 'post',
    response: siteInfo,
  },
]

test.serial('netlify sites:create-template', async (t) => {
  await withMockApi(routes, async ({ apiUrl }) => {
    Object.defineProperty(process, 'env', {
      value: {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_AUTH_TOKEN: 'fake-token',
      },
    })

    const { default: BaseCommand } = await baseCommandPromise
    const program = new BaseCommand('netlify')

    createSitesFromTemplateCommand(program)

    await program.parseAsync(['', '', 'sites:create-template'])

    t.truthy(gitMock.called)
    t.truthy(getTemplatesStub.called)
    t.truthy(createRepoStub.called)

    t.truthy(
      jsonRenderSpy.calledWith({
        'Admin URL': siteInfo.admin_url,
        URL: siteInfo.ssl_url,
        'Site ID': siteInfo.id,
        'Repo URL': siteInfo.build_settings.repo_url,
      }),
    )
  })
})

test.serial('should not fetch templates if one is passed as option', async (t) => {
  await withMockApi(routes, async ({ apiUrl }) => {
    Object.defineProperty(process, 'env', {
      value: {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_AUTH_TOKEN: 'fake-token',
      },
    })

    const { default: BaseCommand } = await baseCommandPromise
    const program = new BaseCommand('netlify')

    createSitesFromTemplateCommand(program)

    await program.parseAsync([
      '',
      '',
      'sites:create-template',
      '-u',
      'http://github.com/netlify-templates/next-starter',
    ])

    t.truthy(getTemplatesStub.notCalled)
  })
})

test.serial('should throw an error if the URL option is not a valid URL', async (t) => {
  await withMockApi(routes, async ({ apiUrl }) => {
    Object.defineProperty(process, 'env', {
      value: {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_AUTH_TOKEN: 'fake-token',
      },
    })

    const { default: BaseCommand } = await baseCommandPromise
    const program = new BaseCommand('netlify')

    createSitesFromTemplateCommand(program)

    const error = await t.throwsAsync(async () => {
      await program.parseAsync(['', '', 'sites:create-template', '-u', 'not-a-url'])
    })

    t.truthy(error.message.includes('Invalid URL'))
  })
})

test.serial('should return an array of templates with name, source code url and slug', async (t) => {
  await withMockApi(routes, async ({ apiUrl }) => {
    Object.defineProperty(process, 'env', {
      value: {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_AUTH_TOKEN: 'fake-token',
      },
    })

    const templates = await fetchTemplates('fake-token')

    t.truthy(getTemplatesStub.calledWith('fake-token'))
    t.deepEqual(templates, [
      {
        name: 'next-starter',
        sourceCodeUrl: 'http://github.com/netlify-templates/next-starter',
        slug: 'netlify-templates/next-starter',
      },
    ])
  })
})

test.serial('should throw error when name flag is incorrect', async (t) => {
  await withMockApi(routes, async ({ apiUrl }) => {
    Object.defineProperty(process, 'env', {
      value: {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_AUTH_TOKEN: 'fake-token',
      },
    })
    const exitSpy = sinon.stub(process, 'exit')

    const { default: BaseCommand } = await baseCommandPromise
    const program = new BaseCommand('netlify')

    createSitesCreateCommand(program)

    const lengthError = await t.throwsAsync(async () => {
      const LENGTH = 64
      await program.parseAsync(['', '', 'sites:create', '--name', Array.from({ length: LENGTH }).fill('a').join('')])
    })
    t.truthy(lengthError.message.includes('--name should be less than 64 characters'))

    exitSpy.restore()
  })
})
