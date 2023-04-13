import { describe, expect, test } from 'vitest'

import callCli from '../../utils/call-cli.cjs'
import { normalize } from '../../utils/snapshots.cjs'

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
