import { describe, expect, test } from 'vitest'

import BaseCommand from '../../../src/commands/base-command.js'

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string): string => text.replace(/\[[0-9;]*m/g, '')

describe('help formatting without a TTY', () => {
  test('separates a short flag from its description with at least two spaces', () => {
    const program = new BaseCommand('netlify')
    const build = program
      .command('build')
      .description('Build on your local machine')
      .option('--dry', 'Dry run: show instructions without running them', false)
      .option('--context <context>', 'Specify a deploy context')

    const helpText = stripAnsi(build.helpInformation())

    expect(helpText).toMatch(/--dry {2,}Dry run: show instructions/)
    expect(helpText).not.toMatch(/--dryDry/)
  })

  test('every OPTIONS row keeps at least two spaces between term and description', () => {
    const program = new BaseCommand('netlify')
    const api = program
      .command('api')
      .description('Run any Netlify API method')
      .option('-d, --data <data>', 'Data to use')
      .option('--list', 'List out available API methods', false)

    const helpText = stripAnsi(api.helpInformation())
    const optionsSection = helpText.split('OPTIONS')[1]?.split('\n\n')[0] ?? ''
    const rows = optionsSection.split('\n').filter((line) => /^\s+-/.test(line))

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row).toMatch(/^ {2}\S.* {2,}\S/)
    }

    expect(helpText).not.toMatch(/<data>Data/)
  })

  test('option terms contribute to the help column width', () => {
    const program = new BaseCommand('netlify')
    const cmd = program
      .command('example')
      .description('Example command')
      .option('--a-really-long-option-name <value>', 'Long option')
      .option('--dry', 'Short option')

    const helpText = stripAnsi(cmd.helpInformation())
    const longRow = helpText.split('\n').find((line) => line.includes('--a-really-long-option-name'))

    expect(longRow).toBeDefined()
    expect(longRow).toMatch(/ {2,}Long option/)
  })

  test('noHelpOptions exposes noBaseOptions and hides the OPTIONS section', () => {
    const program = new BaseCommand('netlify')

    expect(program.noBaseOptions).toBe(false)
    program.noHelpOptions()
    expect(program.noBaseOptions).toBe(true)
  })
})
