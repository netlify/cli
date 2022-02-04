const process = require('process')

const test = require('ava')
const sinon = require('sinon')
// const stripAnsi = require('strip-ansi')

// Important to do the mocks before the code that uses it is required
// in this case the mocks have to be done before the createSitesFromTemplateCommand
// is required!
/* eslint-disable import/order */
const github = require('../../src/utils/init/config-github')
// mock the getGithubToken method with a fake token
sinon.stub(github, 'getGitHubToken').callsFake(() => 'my-token')

/* eslint-enable import/order */

const { BaseCommand } = require('../../src/commands/base-command')
const { createSitesFromTemplateCommand } = require('../../src/commands/sites/sites-create-template')

// const { CONFIRM, answerWithValue, handleQuestions } = require('./utils/handle-questions')
const { withMockApi } = require('./utils/mock-api')

// TODO: Flaky tests enable once fixed
/**
 * As some of the tests are flaky on windows machines I will skip them for now
 * @type {import('ava').TestInterface}
 */
test.skip('netlify sites:create-template', async () => {
  // const siteTemplateQuestions = [
  //   { question: 'Template: (Use arrow keys)', answer: CONFIRM },
  //   { question: 'Team: (Use arrow keys)', answer: CONFIRM },
  //   { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
  // ]

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
      response: { id: 'site_id', name: 'test-site-name' },
    },
  ]

  await withMockApi(routes, async ({ apiUrl }) => {
    Object.defineProperty(process, 'env', {
      value: {
        NETLIFY_API_URL: apiUrl,
        NETLIFY_AUTH_TOKEN: 'fake-token',
      },
    })

    const program = new BaseCommand('netlify')
    createSitesFromTemplateCommand(program)

    await program.parseAsync(['', '', 'sites:create-template'])

    //   handleQuestions(childProcess, siteTemplateQuestions)
    //   const { stdout } = await childProcess

    //   const formattedOutput = JSON.stringify(stripAnsi(stdout)).replace(/\\n/g, '')

    //   t.true(formattedOutput.includes(siteInfo.id))
  })
})
