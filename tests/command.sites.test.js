const process = require('process')

const test = require('ava')
const execa = require('execa')
const stripAnsi = require('strip-ansi')

const cliPath = require('./utils/cli-path')
const { CONFIRM, answerWithValue, handleQuestions } = require('./utils/handle-questions')
const { withMockApi } = require('./utils/mock-api')
// TODO: Flaky tests enable once fixed
/**
 * As some of the tests are flaky on windows machines I will skip them for now
 * @type {import('ava').TestInterface}
 */

const windowsSkip = process.platform === 'win32' ? test.skip : test

windowsSkip.skip('netlify sites:create-template', async (t) => {
  const siteTemplateQuestions = [
    { question: 'Template: (Use arrow keys)', answer: CONFIRM },
    { question: 'Team: (Use arrow keys)', answer: CONFIRM },
    { question: 'Site name (optional)', answer: answerWithValue('test-site-name') },
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
    const childProcess = execa(cliPath, ['sites:create-template'], {
      env: { NETLIFY_API_URL: apiUrl, NETLIFY_AUTH_TOKEN: 'fake-token' },
    })
    handleQuestions(childProcess, siteTemplateQuestions)
    const { stdout } = await childProcess

    const formattedOutput = JSON.stringify(stripAnsi(stdout)).replace(/\\n/g, '')

    t.true(formattedOutput.includes(siteInfo.id))
  })
})
