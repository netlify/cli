import process from 'process'

import { test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { withSiteBuilder } from '../../utils/site-builder.js'

test('should throw if invalid country arg is passed', async (t) => {
  await withSiteBuilder(t, async (builder) => {
    await builder.build()

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
