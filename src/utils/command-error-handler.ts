import { CommanderError, type Command, type HelpContext } from 'commander'
import { distance } from 'fastest-levenshtein'

import { BANG, chalk, log } from './command-helpers.js'
import { isInteractive } from './scripted-commands.js'

const OPTION_ERROR_CODES = new Set([
  'commander.unknownOption',
  'commander.missingArgument',
  'commander.excessArguments',
])

const UNKNOWN_OPTION_PATTERN = /unknown option '([^']+)'/
const MAX_FLAG_EDIT_DISTANCE = 2
const MAX_FLAG_SUGGESTIONS = 3
const MAX_OWNING_COMMANDS = 3

const stripDashes = (flag: string): string => flag.replace(/^-+/, '')

const isCloseTo =
  (target: string) =>
  (flag: string): boolean =>
    distance(stripDashes(target), stripDashes(flag)) <= MAX_FLAG_EDIT_DISTANCE

const byClosestTo =
  (target: string) =>
  (flagA: string, flagB: string): number =>
    distance(stripDashes(target), stripDashes(flagA)) - distance(stripDashes(target), stripDashes(flagB))

export const getUnknownOptionSuggestions = (command: Command, errorMessage: string): string[] => {
  const match = UNKNOWN_OPTION_PATTERN.exec(errorMessage)
  if (match === null) {
    return []
  }
  const unknownFlag = match[1]
  const lines: string[] = []

  if (!errorMessage.includes('Did you mean')) {
    const ownFlags = command.options
      .filter((option) => !option.hidden)
      .flatMap((option) => option.long ?? [])
      .filter(isCloseTo(unknownFlag))
      .sort(byClosestTo(unknownFlag))
      .slice(0, MAX_FLAG_SUGGESTIONS)
    if (ownFlags.length !== 0) {
      lines.push(`Did you mean ${ownFlags.map((flag) => `'${flag}'`).join(' or ')}?`)
    }
  }

  const isRoot = command.parent === null
  const errorBelongsToSubcommand =
    command.args.length !== 0 &&
    command.commands.some((cmd) => cmd.name() === command.args[0] || cmd.aliases().includes(command.args[0]))
  if (isRoot && !errorBelongsToSubcommand) {
    const flagOwners = new Map<string, string[]>()
    for (const subcommand of command.commands) {
      // @ts-expect-error TS(2551) FIXME: Property '_hidden' does not exist on type 'Command'.
      if (subcommand._hidden) continue
      for (const option of subcommand.options) {
        if (option.hidden || !option.long) continue
        const owners = flagOwners.get(option.long) ?? []
        if (!owners.includes(subcommand.name())) {
          owners.push(subcommand.name())
        }
        flagOwners.set(option.long, owners)
      }
    }
    const candidates = [...flagOwners.keys()]
      .filter(isCloseTo(unknownFlag))
      .sort(byClosestTo(unknownFlag))
      .slice(0, MAX_FLAG_SUGGESTIONS)
    for (const flag of candidates) {
      const owners = (flagOwners.get(flag) ?? []).sort((ownerA, ownerB) => ownerA.localeCompare(ownerB))
      const shownOwners = owners.slice(0, MAX_OWNING_COMMANDS).join(', ')
      const ellipsis = owners.length > MAX_OWNING_COMMANDS ? ', ...' : ''
      lines.push(`'${flag}' is a flag of: ${shownOwners}${ellipsis} (run 'netlify <command> --help')`)
    }
  }

  return lines
}

export const suggestUnknownOptionAlternatives = (command: Command, error: CommanderError): void => {
  if (error.code !== 'commander.unknownOption') {
    return
  }
  for (const line of getUnknownOptionSuggestions(command, error.message)) {
    process.stderr.write(` ${chalk.red(BANG)}   ${line}\n`)
  }
}

export const isOptionError = (error: CommanderError): boolean => OPTION_ERROR_CODES.has(error.code)

export const handleOptionError = (command: { outputHelp: (context?: HelpContext) => void }): void => {
  if (!isInteractive()) {
    log()
    command.outputHelp({ error: true })
    log()
  }
}
