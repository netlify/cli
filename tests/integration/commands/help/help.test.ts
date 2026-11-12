import { describe, expect, test } from 'vitest'

import { callCli } from '../../utils/call-cli.js'
import { normalize } from '../../utils/snapshots.js'

describe('help command', () => {
  test('netlify help', async () => {
    const cliResponse = (await callCli(['help'])) as string
    expect(normalize(cliResponse)).toMatchSnapshot()
  })

  test('netlify help completion', async () => {
    const cliResponse = (await callCli(['help', 'completion'])) as string
    expect(normalize(cliResponse)).toMatchSnapshot()
  })

  test('netlify help database lists nested subcommands', async () => {
    const cliResponse = (await callCli(['help', 'database'])) as string
    expect(normalize(cliResponse)).toMatchSnapshot()
  })

  test('netlify help database migrations lists nested subcommands', async () => {
    const cliResponse = (await callCli(['database', 'migrations', '--help'])) as string
    expect(normalize(cliResponse)).toMatchSnapshot()
  })
})
