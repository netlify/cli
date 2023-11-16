
import { OptionValues, Option } from 'commander'

import {  normalizeContext } from '../../utils/env/index.mjs'
import BaseCommand from '../base-command.mjs'

import { createEnvCloneCommand } from './env-clone.mjs'
import { createEnvImportCommand } from './env-import.mjs'
import { createEnvListCommand } from './env-list.mjs'
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

  createEnvImportCommand(program)
  createEnvListCommand(program)
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
