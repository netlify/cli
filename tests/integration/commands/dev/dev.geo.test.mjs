import process from 'process'

import test from 'ava'

import callCli from '../../utils/call-cli.cjs'
import { withSiteBuilder } from '../../utils/site-builder.cjs'

test('should throw if invalid country arg is passed', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const options = {
      cwd: builder.directory,
      extendEnv: false,
      PATH: process.env.PATH,
    }

    await t.throwsAsync(() => callCli(['dev', '--geo=mock', '--country=a1'], options))
    await t.throwsAsync(() => callCli(['dev', '--geo=mock', '--country=NotARealCountryCode'], options))
    await t.throwsAsync(() => callCli(['dev', '--geo=mock', '--country='], options))
  })
})
