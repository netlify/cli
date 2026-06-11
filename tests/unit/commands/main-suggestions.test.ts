import { Command } from 'commander'
import { afterEach, describe, expect, test, vi } from 'vitest'

import BaseCommand from '../../../src/commands/base-command.js'
import { getUnknownOptionSuggestions } from '../../../src/utils/command-error-handler.js'

const getSubcommand = (program: Command, name: string): Command => {
  const found = program.commands.find((cmd) => cmd.name() === name)
  if (found === undefined) {
    throw new Error(`missing subcommand ${name}`)
  }
  return found
}

const buildRootCommand = () => {
  const program = new Command('netlify')
  program.option('--telemetry-disable', 'Disable telemetry')
  program.command('env:list').option('--json', 'Output environment variables as JSON')
  program.command('sites:list').option('--json', 'Output project data as JSON')
  program.command('status').option('--json', 'Output status information as JSON')
  program.command('deploy').option('--json', 'Output deployment data as JSON')
  program
    .command('agents:create')
    .option('-a, --agent <agent>', 'agent type (claude, codex, gemini)')
    .option('--json', 'output result as JSON')
  return program
}

describe('getUnknownOptionSuggestions', () => {
  test('suggests close flags from the current command when commander gave no suggestion', () => {
    const program = buildRootCommand()
    const subcommand = getSubcommand(program, 'env:list')

    const lines = getUnknownOptionSuggestions(subcommand, "error: unknown option '--jsno'")

    expect(lines).toContain("Did you mean '--json'?")
  })

  test('does not duplicate a suggestion commander already made', () => {
    const program = buildRootCommand()
    const subcommand = getSubcommand(program, 'env:list')

    const lines = getUnknownOptionSuggestions(subcommand, "error: unknown option '--jsno'\n(Did you mean --json?)")

    expect(lines.filter((line) => line.startsWith('Did you mean'))).toHaveLength(0)
  })

  test('at the root, names the owning commands of close subcommand flags (capped at 3 with ellipsis)', () => {
    const program = buildRootCommand()

    const lines = getUnknownOptionSuggestions(program, "error: unknown option '--jsno'")

    expect(lines).toContain("'--json' is a flag of: agents:create, deploy, env:list, ... (run 'netlify <command> --help')")
  })

  test('at the root, suggests typoed flags that only exist on subcommands', () => {
    const program = buildRootCommand()

    const lines = getUnknownOptionSuggestions(program, "error: unknown option '--aegnt'")

    expect(lines.some((line) => line.includes("'--agent' is a flag of: agents:create"))).toBe(true)
  })

  test('stays silent when no flag is within edit distance 2', () => {
    const program = buildRootCommand()

    expect(getUnknownOptionSuggestions(program, "error: unknown option '--zzzzzzzzz'")).toEqual([])
  })

  test('skips the cross-command index when the error came from a dispatched subcommand', () => {
    const program = buildRootCommand()
    program.args = ['env:list', '--jsno']

    const lines = getUnknownOptionSuggestions(program, "error: unknown option '--jsno'")

    expect(lines.filter((line) => line.includes('is a flag of'))).toHaveLength(0)
  })

  test('returns nothing for non unknown-option messages', () => {
    const program = buildRootCommand()

    expect(getUnknownOptionSuggestions(program, "error: missing required argument 'name'")).toEqual([])
  })
})

describe('namespace parent commands reject space-form subcommands', () => {
  const stderrChunks: string[] = []

  const buildSitesCommand = () => {
    const program = new BaseCommand('netlify')
    program.command('sites:create').description('Create an empty project')
    program.command('sites:delete').description('Delete a project')
    program.command('sites:list').description('List all projects')
    return program.command('sites').description('Handle various project operations')
  }

  const mockProcess = () => {
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrChunks.push(String(chunk))
      return true
    })
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`exit(${String(code ?? 0)})`)
    })
  }

  afterEach(() => {
    stderrChunks.length = 0
    vi.restoreAllMocks()
  })

  test('errors with exit 1 and a colon-form did-you-mean for a known subcommand', () => {
    const sites = buildSitesCommand()
    sites.args = ['delete', 'my-site-id']
    mockProcess()

    expect(() => {
      sites.rejectSpaceFormSubcommand()
    }).toThrow('exit(1)')

    const stderr = stderrChunks.join('')
    expect(stderr).toContain("'netlify sites delete' is not a command")
    expect(stderr).toContain("Did you mean 'netlify sites:delete my-site-id'?")
    expect(stderr).toContain("Run 'netlify sites --help'")
  })

  test('suggests the closest colon-form subcommand for a near-miss', () => {
    const sites = buildSitesCommand()
    sites.args = ['delte', 'my-site-id']
    mockProcess()

    expect(() => {
      sites.rejectSpaceFormSubcommand()
    }).toThrow('exit(1)')

    expect(stderrChunks.join('')).toContain('sites:delete')
  })

  test('is a no-op when no positional arguments were given', () => {
    const sites = buildSitesCommand()
    sites.args = []
    mockProcess()

    expect(() => {
      sites.rejectSpaceFormSubcommand()
    }).not.toThrow()
    expect(stderrChunks).toHaveLength(0)
  })

  test('helpOrRejectExtraArgs still prints help for bare invocations', () => {
    const sites = buildSitesCommand()
    sites.args = []
    const stdoutChunks: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutChunks.push(String(chunk))
      return true
    })
    mockProcess()

    expect(() => {
      sites.helpOrRejectExtraArgs()
    }).toThrow('exit(0)')
    expect(stdoutChunks.join('')).toContain('sites:delete')
    expect(stderrChunks.join('')).toBe('')
  })
})
