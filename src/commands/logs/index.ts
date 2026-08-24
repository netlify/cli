import { Argument, Option, OptionValues } from 'commander'

import { chalk, logAndThrowError, netlifyCommand } from '../../utils/command-helpers.js'
import BaseCommand from '../base-command.js'

import { CLI_LOG_LEVEL_CHOICES_STRING } from './log-levels.js'

const createDeprecatedFunctionCommand = (program: BaseCommand) => {
  const base = netlifyCommand()

  const cmd = program
    .command('logs:function', { hidden: true })
    .alias('logs:functions')
    .description(`[Deprecated] Use \`${base} logs\` instead`)
    .addArgument(new Argument('[functionNames...]'))
    .allowUnknownOption(true)

  cmd.action((functionNames: string[]) => {
    const functionFlags = functionNames.map((name) => `--function ${name}`).join(' ')
    const example =
      functionNames.length > 0
        ? `${base} logs --source functions ${functionFlags} --since 10m`
        : `${base} logs --source functions --since 10m`

    return logAndThrowError(
      [
        `\`${base} logs:function\` has been replaced by a more comprehensive \`${base} logs\` command.`,
        '',
        `To get logs for ${
          functionNames.length > 0
            ? functionNames.length === 1
              ? 'this function'
              : 'these functions'
            : 'all functions'
        } from the last 10 minutes, run:`,
        '',
        `  ${chalk.cyan(example)}`,
        '',
        `Run ${chalk.cyan(`${base} logs --help`)} to see all available options.`,
      ].join('\n'),
    )
  })
}

const createDeprecatedEdgeFunctionCommand = (program: BaseCommand) => {
  const base = netlifyCommand()

  program
    .command('logs:edge-functions', { hidden: true })
    .description(`[Deprecated] Use \`${base} logs\` instead`)
    .allowUnknownOption(true)
    .action(() =>
      logAndThrowError(
        [
          `\`${base} logs:edge-functions\` has been replaced by a more comprehensive \`${base} logs\` command.`,
          '',
          'To get edge function logs from the last 10 minutes, run:',
          '',
          `  ${chalk.cyan(`${base} logs --source edge-functions --since 10m`)}`,
          '',
          `Run ${chalk.cyan(`${base} logs --help`)} to see all available options.`,
        ].join('\n'),
      ),
    )
}

const createDeprecatedDeployCommand = (program: BaseCommand) => {
  const base = netlifyCommand()

  const cmd = program
    .command('logs:deploy', { hidden: true })
    .alias('logs:build')
    .description(`[Deprecated] Use \`${base} logs\` instead`)
    .allowUnknownOption(true)

  cmd.action(() =>
    logAndThrowError(
      [
        `\`${base} logs:deploy\` has been replaced by a more comprehensive \`${base} logs\` command.`,
        '',
        'To stream deploy logs in real time, run:',
        '',
        `  ${chalk.cyan(`${base} logs --source deploy --follow`)}`,
        '',
        'To view historical deploy logs for the past hour, run:',
        '',
        `  ${chalk.cyan(`${base} logs --source deploy --since 1h`)}`,
        '',
        `Run ${chalk.cyan(`${base} logs --help`)} to see all available options.`,
      ].join('\n'),
    ),
  )
}

export const createLogsCommand = (program: BaseCommand) => {
  createDeprecatedFunctionCommand(program)
  createDeprecatedEdgeFunctionCommand(program)
  createDeprecatedDeployCommand(program)

  return program
    .command('logs')
    .alias('log')
    .description('View logs from your project')
    .addOption(
      new Option('-s, --source <type...>', 'Log sources to include. Defaults to functions and edge-functions').choices([
        'functions',
        'edge-functions',
        'deploy',
      ]),
    )
    .addOption(new Option('--function <name...>', 'Filter to specific functions by name'))
    .addOption(new Option('--edge-function <name...>', 'Filter to specific edge functions by name or path'))
    .addOption(
      new Option(
        '--since <time>',
        'Start of the historical log window. Accepts a duration (e.g. 10m, 1h, 24h) or an ISO 8601 timestamp. Defaults to 10m',
      ),
    )
    .addOption(
      new Option(
        '--until <time>',
        'End of the historical log window. Accepts a duration or an ISO 8601 timestamp (defaults to now)',
      ),
    )
    .addOption(new Option('-f, --follow', 'Stream logs in real time instead of showing historical logs'))
    .addOption(
      new Option(
        '-u, --url <url>',
        'Show logs for the deploy behind the given URL. Supports deploy permalinks and branch subdomains',
      ),
    )
    .addOption(
      new Option('-l, --level <levels...>', `Log levels to include. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`),
    )
    .addOption(new Option('--json', 'Output logs as JSON Lines'))
    .addExamples([
      'netlify logs',
      'netlify logs --since 1h',
      'netlify logs --source functions --function checkout --since 24h',
      'netlify logs --source edge-functions --since 30m',
      'netlify logs --source deploy --source functions --since 1h',
      'netlify logs --follow',
      'netlify logs --follow --source functions --source edge-functions',
      'netlify logs --json --since 1h',
      'netlify logs --url https://my-branch--my-site.netlify.app --since 1h',
    ])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { logsCommand } = await import('./logs.js')
      await logsCommand(options, command)
    })
}
