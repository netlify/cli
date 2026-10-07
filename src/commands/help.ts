import { type Command, Help } from 'commander'

import { NETLIFY_CYAN, USER_AGENT, chalk, padLeft, sortOptions } from '../utils/command-helpers.js'
import type BaseCommand from './base-command.js'

/** The fallback width for the help terminal */
const FALLBACK_HELP_CMD_WIDTH = 80

const HELP_$ = NETLIFY_CYAN('$')
/** indent on commands or description on the help page */
const HELP_INDENT_WIDTH = 2
/** separator width between term and description */
const HELP_SEPARATOR_WIDTH = 5

const formatHelpList = (textArray: string[]) => textArray.join('\n').replace(/^/gm, ' '.repeat(HELP_INDENT_WIDTH))

// Every command in the tree is created through `BaseCommand.createCommand`.
const asBaseCommand = (cmd: Command) => cmd as BaseCommand

const isRoot = (cmd: Command) => cmd.name() === 'netlify'

const isHidden = (cmd: Command) => Boolean((cmd as Command & { _hidden?: boolean })._hidden)

// Subcommands are registered flat on the root as `parent:child`, so a command's children are root siblings
// carrying its name as a prefix.
const listedSubcommands = (cmd: Command): Command[] => {
  const container = isRoot(cmd) ? cmd : cmd.parent
  return (container?.commands ?? [])
    .filter((sub) => !isHidden(sub))
    .filter((sub) => (isRoot(cmd) ? !sub.name().includes(':') : sub.name().startsWith(`${cmd.name()}:`)))
    .sort((a, b) => a.name().localeCompare(b.name()))
}

export class NetlifyHelp extends Help {
  override commandUsage(cmd: Command): string {
    const term = isRoot(cmd)
      ? `${HELP_$} ${cmd.name()} [COMMAND]`
      : `${HELP_$} ${cmd.parent?.name() ?? ''} ${cmd.name()} ${cmd.usage()}`
    return padLeft(term, HELP_INDENT_WIDTH)
  }

  override longestSubcommandTermLength(cmd: Command): number {
    return listedSubcommands(cmd).reduce((max, sub) => Math.max(max, sub.name().length), 0)
  }

  override longestOptionTermLength(cmd: Command, helper: Help): number {
    return asBaseCommand(cmd).noBaseOptions ? 0 : super.longestOptionTermLength(cmd, helper)
  }

  override formatHelp(cmd: Command, helper: Help): string {
    const command = asBaseCommand(cmd)
    const termWidth = helper.padWidth(command, helper)
    const helpWidth = helper.helpWidth || FALLBACK_HELP_CMD_WIDTH

    const formatItem = (term: string, description?: string, isCommand = false): string => {
      const bang = isCommand ? `${HELP_$} ` : ''
      if (!description) {
        return `${bang}${term}`
      }
      const pad = Math.max(termWidth + HELP_SEPARATOR_WIDTH - (isCommand ? 2 : 0), term.length + 2)
      const fullText = `${bang}${term.padEnd(pad)}${chalk.grey(description)}`
      return helper.wrap(fullText, helpWidth - HELP_INDENT_WIDTH, pad + (isCommand ? 2 : 0))
    }

    const output: string[] = []
    const addSection = (title: string, lines: string[]) => {
      if (lines.length !== 0) {
        output.push(chalk.bold(title), formatHelpList(lines), '')
      }
    }

    const [topDescription, ...longDescription] = (helper.commandDescription(command) || '').split('\n')
    if (topDescription.length !== 0) {
      output.push(topDescription, '')
    }

    if (isRoot(command)) {
      addSection('VERSION', [formatItem(USER_AGENT)])
    }

    output.push(chalk.bold('USAGE'), helper.commandUsage(command), '')

    addSection(
      'ARGUMENTS',
      helper
        .visibleArguments(command)
        .map((argument) => formatItem(helper.argumentTerm(argument), helper.argumentDescription(argument))),
    )

    if (!command.noBaseOptions) {
      addSection(
        'OPTIONS',
        helper
          .visibleOptions(command)
          .sort(sortOptions)
          .map((option) => formatItem(helper.optionTerm(option), helper.optionDescription(option))),
      )
    }

    addSection('DESCRIPTION', longDescription)

    const aliasParent = isRoot(command) ? command : command.parent
    addSection(
      'ALIASES',
      command.aliases().map((alias) => formatItem(`${aliasParent?.name() ?? ''} ${alias}`, undefined, true)),
    )

    addSection(
      'EXAMPLES',
      command.examples.map((example) => `${HELP_$} ${example}`),
    )

    addSection(
      'COMMANDS',
      listedSubcommands(command).map((sub) =>
        formatItem(sub.name(), helper.subcommandDescription(sub).split('\n')[0], true),
      ),
    )

    return [...output, ''].join('\n')
  }
}
