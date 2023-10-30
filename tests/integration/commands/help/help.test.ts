import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.mjs'
import { normalize } from '../../utils/snapshots.mjs'

describe('help command', () => {
  test('netlify help', async () => {
    const cliResponse = await callCli(['help'])
    expect(normalize(cliResponse)).toMatchSnapshot()
  })

  test('netlify help completion', async () => {
    const cliResponse = await callCli(['help', 'completion'])
    expect(normalize(cliResponse)).toMatchSnapshot()
  })
})
