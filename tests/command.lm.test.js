const { readFile } = require('fs').promises
const os = require('os')
const process = require('process')

const execa = require('execa')
const ini = require('ini')

const { getPathInHome } = require('../src/lib/settings')

const callCli = require('./utils/call-cli')
const { getCLIOptions, startMockApi } = require('./utils/mock-api')
const { createSiteBuilder } = require('./utils/site-builder')

// The test can take a little bit longer than the default 5s
// eslint-disable-next-line no-magic-numbers
jest.setTimeout(7000)

let execOptions
let builder
let mockApi

afterAll(async () => {
  await callCli(['lm:uninstall'], execOptions)
  await builder.cleanupAsync()
  mockApi.close()
})

beforeAll(async () => {
  builder = createSiteBuilder({ siteName: 'site-with-lm' })
  await builder.buildAsync()

  const siteInfo = {
    account_slug: 'test-account',
    id: 'site_id',
    name: 'site-name',
    id_domain: 'localhost',
  }
  const { server } = startMockApi({
    routes: [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      { method: 'post', path: 'sites/site_id/services/large-media/instances', status: 201 },
    ],
  })

  execOptions = getCLIOptions({ builder, apiUrl: `http://localhost:${server.address().port}/api/v1` })
  execOptions = { ...execOptions, env: { ...execOptions.env, SHELL: process.env.SHELL || 'bash' } }
  mockApi = server

  await callCli(['lm:uninstall'], execOptions)
})

test('netlify lm:info', async () => {
  const cliResponse = await callCli(['lm:info'], execOptions)
  expect(cliResponse.includes('Checking Git version')).toBe(true)
  expect(cliResponse.includes('Checking Git LFS version')).toBe(true)
  expect(cliResponse.includes('Checking Git LFS filters')).toBe(true)
  expect(cliResponse.includes("Checking Netlify's Git Credentials version")).toBe(true)
})

test('netlify lm:install', async () => {
  const cliResponse = await callCli(['lm:install'], execOptions)
  expect(cliResponse.includes('Checking Git version')).toBe(true)
  expect(cliResponse.includes('Checking Git LFS version')).toBe(true)
  expect(cliResponse.includes('Checking Git LFS filters')).toBe(true)
  expect(cliResponse.includes("Installing Netlify's Git Credential Helper")).toBe(true)
  expect(cliResponse.includes("Configuring Git to use Netlify's Git Credential Helper [started]")).toBe(true)
  expect(cliResponse.includes("Configuring Git to use Netlify's Git Credential Helper [completed]")).toBe(true)

  // verify git-credential-netlify was added to the PATH
  if (os.platform() === 'win32') {
    expect(cliResponse.includes(`Adding ${getPathInHome(['helper', 'bin'])} to the`)).toBe(true)
    expect(cliResponse.includes('Netlify Credential Helper for Git was installed successfully.')).toBe(true)
    // no good way to test that it was added to the PATH on windows so we test it was installed
    // in the expected location
    const { stdout } = await execa('git-credential-netlify', ['version'], {
      cwd: `${os.homedir()}\\AppData\\Roaming\\netlify\\config\\helper\\bin`,
    })
    expect(stdout.startsWith('git-credential-netlify')).toBe(true)
  } else {
    expect(cliResponse.includes('Run this command to use Netlify Large Media in your current shell')).toBe(true)
    // The source path is always an absolute path so we can match for starting with `/`.
    // The reasoning behind this regular expression is, that on different shells the border of the box inside the command output
    // can infer with line breaks and split the source with the path.
    // https://regex101.com/r/2d5BUn/1
    //                                       /source[\s\S]+?(\/.+inc)/
    //                                       /      [\s\S]           / \s matches any whitespace character and \S any non whitespace character
    //                                       /            +?         / matches at least one character but until the next group
    //                                       /              (\/.+inc)/ matches any character until `inc` (the path starting with a `\`)
    const [, sourcePath] = cliResponse.match(/source[\s\S]+?(\/.+inc)/)
    const { stdout } = await execa.command(`source ${sourcePath} && git-credential-netlify version`, {
      shell: execOptions.env.SHELL,
    })
    expect(stdout.startsWith('git-credential-netlify')).toBe(true)
  }
})

test('netlify lm:setup', async () => {
  const cliResponse = await callCli(['lm:setup'], execOptions)
  expect(cliResponse.includes('Provisioning Netlify Large Media [started]')).toBe(true)
  expect(cliResponse.includes('Provisioning Netlify Large Media [completed]')).toBe(true)
  expect(cliResponse.includes('Configuring Git LFS for this site [started]')).toBe(true)
  expect(cliResponse.includes('Configuring Git LFS for this site [completed]')).toBe(true)

  const lfsConfig = ini.parse(await readFile(`${builder.directory}/.lfsconfig`, 'utf8'))
  expect(lfsConfig.lfs.url).toBe('https://localhost/.netlify/large-media')
})
