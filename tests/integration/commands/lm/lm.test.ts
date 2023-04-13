import { readFile } from 'fs/promises'
import os from 'os'
import process from 'process'

import execa from 'execa'
import ini from 'ini'
import { describe, expect, test } from 'vitest'

import { getPathInHome } from '../../../../src/lib/settings.mjs'
import { FixtureOptions, HTTPMethod, setupFixtureTests } from '../../utils/fixture.js'
import { getCLIOptions } from '../../utils/mock-api.cjs'

const siteInfo = {
  account_slug: 'test-account',
  id: 'site_id',
  name: 'site-name',
  id_domain: 'localhost',
}

const routes = [
  { path: 'sites/site_id', response: siteInfo },
  { path: 'sites/site_id/service-instances', response: [] },
  {
    path: 'accounts',
    response: [{ slug: siteInfo.account_slug }],
  },
  { method: HTTPMethod.POST, path: 'sites/site_id/services/large-media/instances', status: 201 },
]
describe('lm command', () => {
  let execOptions
  const fixtureOptions: FixtureOptions = {
    mockApi: { routes },
    async setup({ fixture, mockApi }) {
      const CLIOptions = getCLIOptions({ apiUrl: `http://localhost:${mockApi?.server.address().port}/api/v1` })
      execOptions = { ...CLIOptions, env: { ...CLIOptions.env, SHELL: process.env.SHELL || 'bash' } }
      await fixture.callCli(['lm:uninstall'], { execOptions })
    },
    async teardown({ fixture }) {
      await fixture.callCli(['lm:uninstall'], { execOptions })
    },
  }

  setupFixtureTests('empty-project', fixtureOptions, ({ fixture }) => {
    test('netlify lm:info', async () => {
      const cliResponse = await fixture.callCli(['lm:info'], { offline: false, execOptions })
      expect(cliResponse).toContain('Checking Git version')
      expect(cliResponse).toContain('Checking Git LFS version')
      expect(cliResponse).toContain('Checking Git LFS filters')
      expect(cliResponse).toContain("Checking Netlify's Git Credentials version")
    })

    test('netlify lm:install', async () => {
      const cliResponse = await fixture.callCli(['lm:install'], { offline: false, execOptions })
      expect(cliResponse).toContain('Checking Git version')
      expect(cliResponse).toContain('Checking Git LFS version')
      expect(cliResponse).toContain('Checking Git LFS filters')
      expect(cliResponse).toContain("Installing Netlify's Git Credential Helper")
      expect(cliResponse).toContain("Configuring Git to use Netlify's Git Credential Helper [started]")
      expect(cliResponse).toContain("Configuring Git to use Netlify's Git Credential Helper [completed]")

      // verify git-credential-netlify was added to the PATH
      if (os.platform() === 'win32') {
        expect(cliResponse).toContain(`Adding ${getPathInHome(['helper', 'bin'])} to the`)
        expect(cliResponse).toContain('Netlify Credential Helper for Git was installed successfully.')
        // no good way to test that it was added to the PATH on windows so we test it was installed
        // in the expected location
        const { stdout } = await execa('git-credential-netlify', ['version'], {
          cwd: `${os.homedir()}\\AppData\\Roaming\\netlify\\config\\helper\\bin`,
        })

        expect(stdout.startsWith('git-credential-netlify')).toBe(true)
      } else {
        expect(cliResponse).toContain('Run this command to use Netlify Large Media in your current shell')
        // The source path is always an absolute path so we can match for starting with `/`.
        // The reasoning behind this regular expression is, that on different shells the border of the box inside the command output
        // can infer with line breaks and split the source with the path.
        // https://regex101.com/r/2d5BUn/1
        //                                       /source[\s\S]+?(\/.+inc)/
        //                                       /      [\s\S]           / \s matches any whitespace character and \S any non whitespace character
        //                                       /            +?         / matches at least one character but until the next group
        //                                       /              (\/.+inc)/ matches any character until `inc` (the path starting with a `\`)
        const match = cliResponse.match(/source[\s\S]+?(\/.+inc)/)
        if (!match) expect.fail('could not match path')
        const [, sourcePath] = match
        const { stdout } = await execa.command(`source ${sourcePath} && git-credential-netlify version`, {
          shell: execOptions.env.SHELL,
        })

        expect(stdout.startsWith('git-credential-netlify')).toBe(true)
      }
    })

    test('netlify lm:setup', async () => {
      const cliResponse = await fixture.callCli(['lm:setup'], { offline: false, execOptions })
      expect(cliResponse).toContain('Provisioning Netlify Large Media [started]')
      expect(cliResponse).toContain('Provisioning Netlify Large Media [completed]')
      expect(cliResponse).toContain('Configuring Git LFS for this site [started]')
      expect(cliResponse).toContain('Configuring Git LFS for this site [completed]')

      const lfsConfig = ini.parse(await readFile(`${fixture.directory}/.lfsconfig`, 'utf8'))
      expect(lfsConfig.lfs.url).toBe('https://localhost/.netlify/large-media')
    })
  })
})
