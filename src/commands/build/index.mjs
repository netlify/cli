import process from 'process'

import { normalizeContext } from '../../utils/env/index.mjs'

/**
 * Creates the `netlify build` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */

export const createBuildCommand = (program) =>
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
      const { build } = await import('./build.mjs')
      await build(options, command)
    })
