import process from 'process'

import { test } from 'vitest'

import callCli from '../../utils/call-cli.mjs'
import { withSiteBuilder } from '../../utils/site-builder.mjs'

test('should throw if invalid country arg is passed', async (t) => {
  await withSiteBuilder('site-env', async (builder) => {
    await builder.buildAsync()

    const options = {
      cwd: builder.directory,
      extendEnv: false,
      PATH: process.env.PATH,
    }

    const errors = await Promise.allSettled([
      callCli(['dev', '--geo=mock', '--country=a1'], options),
      callCli(['dev', '--geo=mock', '--country=NotARealCountryCode'], options),
      callCli(['dev', '--geo=mock', '--country='], options),
    ])

    errors.forEach((error) => {
      t.expect(error.status).toEqual('rejected')
    })
  })
})
