import { OptionValues, Option } from 'commander'

import { normalizeContext } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

const env = (_options: OptionValues, command: BaseCommand) => {
  command.help()
}

export const createEnvCommand = (program: BaseCommand) => {
  program
    .command('env:get')
    .argument('<name>', 'Environment variable name')
    .option(
      '-c, --context <context>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      'dev',
    )
    .option('--json', 'Output environment variables as JSON')
    .addOption(
      new Option('-s, --scope <scope>', 'Specify a scope')
        .choices(['builds', 'functions', 'post-processing', 'runtime', 'any'])
        .default('any'),
    )
    .addExamples([
      'netlify env:get MY_VAR # get value for MY_VAR in dev context',
      'netlify env:get MY_VAR --context production',
      'netlify env:get MY_VAR --context branch:staging',
      'netlify env:get MY_VAR --scope functions',
    ])
    .description('Get resolved value of specified environment variable (includes netlify.toml)')
    .action(async (name: string, options: OptionValues, command: BaseCommand) => {
      const { envGet } = await import('./env-get.js')
      await envGet(name, options, command)
    })

  program
    .command('env:import')
    .argument('<fileName>', '.env file to import')
    .option(
      '-R, --replace-existing',
      'Replace all existing variables instead of merging them with the current ones',
      false,
    )
    .option('--json', 'Output environment variables as JSON')
    .description('Import and set environment variables from .env file')
    .action(async (fileName: string, options: OptionValues, command: BaseCommand) => {
      const { envImport } = await import('./env-import.js')
      await envImport(fileName, options, command)
    })

  program
    .command('env:list')
    .option(
      '-c, --context <context>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      'dev',
    )
    .option('--json', 'Output environment variables as JSON')
    .addOption(new Option('--plain', 'Output environment variables as plaintext').conflicts('json'))
    .addOption(
      new Option('-s, --scope <scope>', 'Specify a scope')
        .choices(['builds', 'functions', 'post-processing', 'runtime', 'any'])
        .default('any'),
    )
    .addExamples([
      'netlify env:list # list variables with values in the dev context and with any scope',
      'netlify env:list --context production',
      'netlify env:list --context branch:staging',
      'netlify env:list --scope functions',
      'netlify env:list --plain',
    ])
    .description('Lists resolved environment variables for site (includes netlify.toml)')
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { envList } = await import('./env-list.js')
      await envList(options, command)
    })

  program
    .command('env:set')
    .argument('<key>', 'Environment variable key')
    .argument('[value]', 'Value to set to', '')
    .option(
      '-c, --context <context...>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)',
      // spread over an array for variadic options
      // @ts-expect-error TS(7006) FIXME: Parameter 'context' implicitly has an 'any' type.
      (context, previous = []) => [...previous, normalizeContext(context)],
    )
    .option('--json', 'Output environment variables as JSON')
    .addOption(
      new Option('-s, --scope <scope...>', 'Specify a scope (default: all scopes)').choices([
        'builds',
        'functions',
        'post-processing',
        'runtime',
      ]),
    )
    .option('--secret', 'Indicate whether the environment variable value can be read again.')
    .description('Set value of environment variable')
    .addExamples([
      'netlify env:set VAR_NAME value # set in all contexts and scopes',
      'netlify env:set VAR_NAME value --context production',
      'netlify env:set VAR_NAME value --context production deploy-preview',
      'netlify env:set VAR_NAME value --context production --secret',
      'netlify env:set VAR_NAME value --scope builds',
      'netlify env:set VAR_NAME value --scope builds functions',
      'netlify env:set VAR_NAME --secret # convert existing variable to secret',
    ])
    .action(async (key: string, value: string, options: OptionValues, command: BaseCommand) => {
      const { envSet } = await import('./env-set.js')
      await envSet(key, value, options, command)
    })

  program
    .command('env:unset')
    .aliases(['env:delete', 'env:remove'])
    .argument('<key>', 'Environment variable key')
    .option(
      '-c, --context <context...>',
      'Specify a deploy context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev") (default: all contexts)',
      // spread over an array for variadic options
      // @ts-expect-error TS(7006) FIXME: Parameter 'context' implicitly has an 'any' type.
      (context, previous = []) => [...previous, normalizeContext(context)],
    )
    .option('--json', 'Output environment variables as JSON')
    .addExamples([
      'netlify env:unset VAR_NAME # unset in all contexts',
      'netlify env:unset VAR_NAME --context production',
      'netlify env:unset VAR_NAME --context production deploy-preview',
    ])
    .description('Unset an environment variable which removes it from the UI')
    .action(async (key: string, options: OptionValues, command: BaseCommand) => {
      const { envUnset } = await import('./env-unset.js')
      await envUnset(key, options, command)
    })

  program
    .command('env:clone')
    .alias('env:migrate')
    .option('-f, --from <from>', 'Site ID (From)')
    .requiredOption('-t, --to <to>', 'Site ID (To)')
    .description(`Clone environment variables from one site to another`)
    .addExamples(['netlify env:clone --to <to-site-id>', 'netlify env:clone --to <to-site-id> --from <from-site-id>'])
    .action(async (options: OptionValues, command: BaseCommand) => {
      const { envClone } = await import('./env-clone.js')
      await envClone(options, command)
    })

  return program
    .command('env')
    .description('Control environment variables for the current site')
    .addExamples([
      'netlify env:list',
      'netlify env:get VAR_NAME',
      'netlify env:set VAR_NAME value',
      'netlify env:unset VAR_NAME',
      'netlify env:import fileName',
      'netlify env:clone --to <to-site-id>',
    ])
    .action(env)
}
