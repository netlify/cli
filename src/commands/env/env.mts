
import { OptionValues, Option } from 'commander'

import {  normalizeContext } from '../../utils/env/index.mjs'
import BaseCommand from '../base-command.mjs'

import { createEnvCloneCommand } from './env-clone.mjs'
import { createEnvSetCommand } from './env-set.mjs'
import { createEnvUnsetCommand } from './env-unset.mjs'


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
    const { envGet } = await import('./env-get.mjs')
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
      const {envImport} = await import('./env-import.mjs')
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
      const {envList} = await import('./env-list.mjs')
      await envList(options, command)
    })
  createEnvSetCommand(program)
  createEnvUnsetCommand(program)
  createEnvCloneCommand(program)

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
