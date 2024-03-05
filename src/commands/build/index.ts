import process from 'process'

import { normalizeContext } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'

export const createBuildCommand = (program: BaseCommand) =>
  program
    .command('build')
    .description('Build on your local machine')
    .option(
      '--context <context>',
      'Specify a build context or branch (contexts: "production", "deploy-preview", "branch-deploy", "dev")',
      normalizeContext,
      process.env.CONTEXT || 'production',
    )
    .option('--dry', 'Dry run: show instructions without running them', false)
    .option('-o, --offline', 'disables any features that require network access', false)
    .addExamples(['netlify build'])
    .action(async (options, command) => {
      const { build } = await import('./build.js')
      await build(options, command)
    })
