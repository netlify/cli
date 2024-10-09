import { OptionValues, Option } from 'commander'

import { normalizeContext } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

const env = (options: OptionValues, command: BaseCommand) => {
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
    .addOption(
      new Option(
        '-r --replaceExisting',
        'Old, prefer --replace-existing. Replace all existing variables instead of merging them with the current ones',
      )
        .default(false)
        .hideHelp(true),
    )
    .option(
      '-r, --replace-existing',
      'Replace all existing variables instead of merging them with the current ones',
      false,
    )
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
    .addOption(
      new Option('-s, --scope <scope...>', 'Specify a scope (default: all scopes)').choices([
        'builds',
        'functions',
        'post-processing',
        'runtime',
      ]),
    )
    .addOption(new Option('-f, --force', 'force the operation without warnings'))
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

  //
  // - To prompt before we add an enviroment varaible
  // - if context is not given, then the context will be all
  // - If env:set command is run without any options, then we need to prompt the user to let them know that env will be set for all contexts and scope
  // - If the user passes the -f, then we need to disable the promp
  //   - this will be our force flag, to bypass prompting
  //
  // - context and scope are undefined
  //   - we need to prompt the user to let them know that env will be set for all contexts and scope
  // - context is defined, but scope is not
  // - conext is not defined, but scope is defined
  //
  //
  // Milestones:
  //   1. If no flags are given, then we need to promp the user Y/N,
  //     - we need to let the user know that they are going to set the enviroment variable for all scopes and contexts
  //
  //   2. If the context flag is given, and the scope is not given
  //     -
  //
  //   2. The `-f` should skip the promp
  //     - if the user gives us a -f, then we need to skip the prmopt
  //
  //   3. --scope without premium
  //       - check the status code and message returend by the api
  //       - If the error message is generic
  //         - Check with Daniel, and see what would be the best option
  //           - validate the user has a premium subscription
  //             - if the user does not have a premium subscription, then we need to throw an error
  //             - we can check the api status code and message to see if the user has a premium subscription
  //           - infer if the env variable is not created, and the `--scope` flag is passed
  //             - we can let the user konw that the variable was not created, and they `--scope` is a premium feature
  //               - we can infer this to them
  //           - Netlify makes their api better with better error messages
  //       - add this to the documentation,
  //
  //
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
