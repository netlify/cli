import { describe, expect, test } from 'vitest'

import {
  canReportMissingCommandName,
  getCommandName,
  isNonExistingCommandError,
  shouldUseShell,
} from '../../../src/utils/shell.js'

describe('shell command helpers', () => {
  test('uses a shell only when command syntax requires it', () => {
    expect(shouldUseShell('npm run dev')).toBe(false)
    expect(shouldUseShell('echo first && echo second')).toBe(true)
    expect(shouldUseShell('npm run build || npm run fallback')).toBe(true)
    expect(shouldUseShell('FOO=1 npm run dev')).toBe(true)
  })

  test('extracts quoted and unquoted command names', () => {
    expect(getCommandName('npm run dev')).toBe('npm')
    expect(getCommandName('"my command" --flag')).toBe('my command')
    expect(getCommandName("'my command' --flag")).toBe('my command')
  })

  test('does not report a single missing command for compound shell syntax', () => {
    expect(canReportMissingCommandName('npm run dev')).toBe(true)
    expect(canReportMissingCommandName('echo before && missing-command')).toBe(false)
    expect(canReportMissingCommandName('FOO=1 missing-command')).toBe(false)
  })

  test('detects missing command output without treating package managers as missing commands', () => {
    expect(
      isNonExistingCommandError({
        command: 'missing-command',
        error: { stderr: 'sh: missing-command: command not found', exitCode: 127 },
      }),
    ).toBe(true)

    expect(
      isNonExistingCommandError({
        command: 'npm',
        error: { stderr: 'sh: npm: command not found', exitCode: 127 },
      }),
    ).toBe(false)
  })

  test('does not classify an existing command exit 127 as a missing command', () => {
    expect(
      isNonExistingCommandError({
        command: 'bash',
        error: { shortMessage: 'Command failed with exit code 127: bash -c "exit 127"', exitCode: 127 },
      }),
    ).toBe(false)
  })

  test('does not classify a missing subcommand as a missing wrapper command', () => {
    expect(
      isNonExistingCommandError({
        command: 'bash',
        error: { stderr: 'bash: line 1: missing-subcommand: command not found', exitCode: 127 },
      }),
    ).toBe(false)
  })
})
