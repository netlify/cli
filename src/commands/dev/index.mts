import { Option, OptionValues } from 'commander'

import { BANG, chalk } from '../../utils/command-helpers.mjs'
import { normalizeContext } from '../../utils/env/index.mjs'
import { getGeoCountryArgParser } from '../../utils/validation.mjs'
import BaseCommand from '../base-command.mjs'

const validateShortFlagArgs = (args: string) => {
  if (args.startsWith('=')) {
    throw new Error(
      `Short flag options like -e or -E don't support the '=' sign
 ${chalk.red(BANG)}   Supported formats:
      netlify dev -e
      netlify dev -e 127.0.0.1:9229
      netlify dev -e127.0.0.1:9229
      netlify dev -E
      netlify dev -E 127.0.0.1:9229
      netlify dev -E127.0.0.1:9229`,
    )
  }
  return args
}

export const createDevCommand = (program: BaseCommand) => {
  program
    .command('dev:exec')
    .argument('<...cmd>', `the command that should be executed`)
    .option(
      '--context <context>',
      'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      'dev',
    )
    .description(
      'Exec command\nRuns a command within the netlify dev environment, e.g. with env variables from any installed addons',
    )
    .allowExcessArguments(true)
    .addExamples(['netlify dev:exec npm run bootstrap'])
    .action(async (cmd: string, options: OptionValues, command: BaseCommand) => {
      const { devExec } = await import('./dev-exec.mjs')
      await devExec(cmd, options, command)
    })

  return program
    .command('dev')
    .alias('develop')
    .description(
      `Local dev server\nThe dev command will run a local dev server with Netlify's proxy and redirect rules`,
    )
    .option('-c ,--command <command>', 'command to run')
    .option(
      '--context <context>',
      'Specify a deploy context or branch for environment variables (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
    )
    .option('-p ,--port <port>', 'port of netlify dev', (value) => Number.parseInt(value))
    .addOption(
      new Option('--targetPort <port>', 'Old, prefer --target-port. Port of target app server')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(true),
    )
    .addOption(new Option('--no-open', 'disables the automatic opening of a browser window'))
    .option('--target-port <port>', 'port of target app server', (value) => Number.parseInt(value))
    .option('--framework <name>', 'framework to use. Defaults to #auto which automatically detects a framework')
    .option('-d ,--dir <path>', 'dir with static files')
    .option('-f ,--functions <folder>', 'specify a functions folder to serve')
    .option('-o ,--offline', 'disables any features that require network access')
    .option(
      '-l, --live [subdomain]',
      'start a public live session; optionally, supply a subdomain to generate a custom URL',
      false,
    )
    .addOption(
      new Option('--functionsPort <port>', 'Old, prefer --functions-port. Port of functions server')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(true),
    )
    .option('--functions-port <port>', 'port of functions server', (value) => Number.parseInt(value))
    .addOption(
      new Option(
        '--geo <mode>',
        'force geolocation data to be updated, use cached data from the last 24h if found, or use a mock location',
      )
        .choices(['cache', 'mock', 'update'])
        .default('cache'),
    )
    .addOption(
      new Option(
        '--country <geoCountry>',
        'Two-letter country code (https://ntl.fyi/country-codes) to use as mock geolocation (enables --geo=mock automatically)',
      ).argParser(getGeoCountryArgParser('netlify dev --geo=mock --country=FR')),
    )
    .addOption(
      new Option('--staticServerPort <port>', 'port of the static app server used when no framework is detected')
        .argParser((value) => Number.parseInt(value))
        .hideHelp(),
    )
    .addOption(
      new Option(
        '-e, --edgeInspect [address]',
        'Old, prefer --edge-inspect. Enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format',
      )
        .conflicts('edgeInspectBrk')
        .argParser(validateShortFlagArgs)
        .hideHelp(true),
    )
    .addOption(
      new Option(
        '-e, --edge-inspect [address]',
        'enable the V8 Inspector Protocol for Edge Functions, with an optional address in the host:port format',
      )
        .conflicts('edgeInspectBrk')
        .argParser(validateShortFlagArgs),
    )
    .addOption(
      new Option(
        '-E, --edgeInspectBrk [address]',
        'Old, prefer --edge-inspect-brk. Enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format',
      )
        .conflicts('edgeInspect')
        .hideHelp(true)
        .argParser(validateShortFlagArgs),
    )
    .addOption(
      new Option(
        '-E, --edge-inspect-brk [address]',
        'enable the V8 Inspector Protocol for Edge Functions and pause execution on the first line of code, with an optional address in the host:port format',
      )
        .conflicts('edgeInspect')
        .argParser(validateShortFlagArgs),
    )
    .addExamples([
      'netlify dev',
      'netlify dev -d public',
      'netlify dev -c "hugo server -w" --target-port 1313',
      'netlify dev --context production',
      'netlify dev --edge-inspect',
      'netlify dev --edge-inspect=127.0.0.1:9229',
      'netlify dev --edge-inspect-brk',
      'netlify dev --edge-inspect-brk=127.0.0.1:9229',
      'BROWSER=none netlify dev # disable browser auto opening',
    ])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { dev } = await import('./dev.mjs')
      await dev(options, command)
    })
}
