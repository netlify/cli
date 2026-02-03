import { env, platform } from 'process'

import { Option } from 'commander'
import terminalLink from 'terminal-link'

import { normalizeContext } from '../../utils/env/index.js'
import BaseCommand from '../base-command.js'
import { chalk, logAndThrowError, warn } from '../../utils/command-helpers.js'
import type { DeployOptionValues } from './option_values.js'

export const createDeployCommand = (program: BaseCommand) =>
  program
    .command('deploy')
    .description(
      `Deploy your project to Netlify

Builds and deploys your project to Netlify. Creates a draft deploy by default.
Use --prod to deploy directly to your live site.

The deploy command will:
- Build your project (unless --no-build is specified)
- Upload static files, functions, and edge functions
- Process redirects and headers from netlify.toml or _redirects/_headers files
- Provide deploy and function logs URLs

For detailed configuration options, see the Netlify documentation.`,
    )
    .option('-d, --dir <path>', 'Specify a folder to deploy')
    .option('-f, --functions <folder>', 'Specify a functions folder to deploy')
    .addOption(
      new Option('-p, --prod', 'Deploy to production')
        .default(false)
        .conflicts(['alias', 'branch', 'prod-if-unlocked', 'draft']),
    )
    .addOption(
      new Option('--prod-if-unlocked', 'Deploy to production if unlocked, create a draft otherwise')
        .default(false)
        .conflicts(['alias', 'branch', 'prod', 'draft']),
    )
    .addOption(
      new Option('--draft', 'Explicitly create a draft deploy')
        .default(false)
        .conflicts(['prod', 'prod-if-unlocked'])
        .hideHelp(true),
    )
    .option(
      '--alias <name>',
      'Specifies the alias for deployment, the string at the beginning of the deploy subdomain. Useful for creating predictable deployment URLs. Avoid setting an alias string to the same value as a deployed branch. `alias` doesn’t create a branch deploy and can’t be used in conjunction with the branch subdomain feature. Maximum 37 characters.',
    )
    .addOption(new Option('-b, --branch <name>', 'Do not use - renamed to --alias.').hideHelp(true))
    .option('-O, --open', 'Open project after deploy', false)
    .option('-m, --message <message>', 'A short message to include in the deploy log')
    .option('-s, --site <name-or-id>', 'A project name or ID to deploy to', env.NETLIFY_SITE_ID)
    .option('--json', 'Output deployment data as JSON')
    .option('--timeout <number>', 'Timeout to wait for deployment to finish', (value) => Number.parseInt(value))
    .addOption(
      new Option('--trigger', 'Trigger a new build of your project on Netlify without uploading local files').conflicts(
        'build',
      ),
    )
    .addOption(
      new Option('--build', 'Do not use - this is now the default. Will be removed in future versions.')
        .default(true)
        .hideHelp(true),
    )
    /**
     * Note that this has special meaning to commander. It negates the above `build` option.
     * @see https://github.com/tj/commander.js/tree/83c3f4e391754d2f80b179acc4bccc2d4d0c863d?tab=readme-ov-file#other-option-types-negatable-boolean-and-booleanvalue
     */
    .option(
      '--no-build',
      'Do not run build command before deploying. Only use this if you have no need for a build or your project has already been built.',
    )
    .option(
      '--context <context>',
      'Specify a deploy context for environment variables read during the build ("production", "deploy-preview", "branch-deploy", "dev") or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)',
      normalizeContext,
    )
    .option(
      '--skip-functions-cache',
      'Ignore any functions created as part of a previous `build` or `deploy` commands, forcing them to be bundled again as part of the deployment',
      false,
    )
    .addOption(new Option('--upload-source-zip', 'Upload source code as a zip file').default(false).hideHelp(true))
    .option(
      '--create-site [name]',
      'Create a new site and deploy to it. Optionally specify a name, otherwise a random name will be generated. Requires --team flag if you have multiple teams.',
    )
    .option('--team <slug>', 'Specify team slug when creating a site. Only works with --create-site flag.')
    .addExamples([
      'netlify deploy',
      'netlify deploy --site my-first-project',
      'netlify deploy --no-build # Deploy without running a build first',
      'netlify deploy --prod',
      'netlify deploy --prod --open',
      'netlify deploy --prod-if-unlocked',
      'netlify deploy --message "A message with an $ENV_VAR"',
      'netlify deploy --auth $NETLIFY_AUTH_TOKEN',
      'netlify deploy --trigger',
      'netlify deploy --context deploy-preview',
      'netlify deploy --create-site my-new-site --team my-team # Create site and deploy',
    ])
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/site-deploys/overview/'
      return `
For more information about Netlify deploys, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .action(async (options: DeployOptionValues, command: BaseCommand) => {
      if (command.parent?.opts().verbose) {
        options.verbose = true
      }

      if (options.build && command.getOptionValueSource('build') === 'cli') {
        warn(`${chalk.cyanBright('--build')} is now the default and can safely be omitted.`)
      }

      if (options.branch) {
        warn('--branch flag has been renamed to --alias')
      }

      if (options.context && !options.build) {
        return logAndThrowError('--context flag is only available when using the --build flag')
      }

      if (options.team && !options.createSite) {
        return logAndThrowError('--team flag can only be used with --create-site flag')
      }

      // Handle Windows + source zip upload
      if (options.uploadSourceZip && platform === 'win32') {
        warn('Source zip upload is not supported on Windows. Disabling --upload-source-zip option.')
        options.uploadSourceZip = false
      }

      const { deploy } = await import('./deploy.js')
      await deploy(options, command)
    })
