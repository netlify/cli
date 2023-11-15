// @ts-check
import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'

/**
 * Creates the `netlify functions:build` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsBuildCommand = (program) =>
  program
    .command('functions:build')
    .alias('function:build')
    .description('Build functions locally')
    .option('-f, --functions <directory>', 'Specify a functions directory to build to')
    .option('-s, --src <directory>', 'Specify the source directory for the functions')
    .action(async (options, command) => {
      const { functionsBuild } = await import('./functions-build.mjs')
      await functionsBuild(options, command)
    })

/**
 * Creates the `netlify functions:create` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsCreateCommand = (program) =>
  program
    .command('functions:create')
    .alias('function:create')
    .argument('[name]', 'name of your new function file inside your functions directory')
    .description('Create a new function locally')
    .option('-n, --name <name>', 'function name')
    .option('-u, --url <url>', 'pull template from URL')
    .option('-l, --language <lang>', 'function language')
    .addExamples([
      'netlify functions:create',
      'netlify functions:create hello-world',
      'netlify functions:create --name hello-world',
    ])
    .action(async (name, options, command) => {
      const { functionsCreate } = await import('./functions-create.mjs')
      await functionsCreate(name, options, command)
    })

/**
 * Creates the `netlify functions:invoke` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsInvokeCommand = (program) =>
  program
    .command('functions:invoke')
    .alias('function:trigger')
    .argument('[name]', 'function name to invoke')
    .description(
      `Trigger a function while in netlify dev with simulated data, good for testing function calls including Netlify's Event Triggered Functions`,
    )
    .option('-n, --name <name>', 'function name to invoke')
    .option('-f, --functions <dir>', 'Specify a functions folder to parse, overriding netlify.toml')
    .option('-q, --querystring <query>', 'Querystring to add to your function invocation')
    .option('-p, --payload <data>', 'Supply POST payload in stringified json, or a path to a json file')
    // TODO: refactor to not need the `undefined` state by removing the --identity flag (value `identity` will be then always defined to true or false)
    .option(
      '--identity',
      'simulate Netlify Identity authentication JWT. pass --identity to affirm unauthenticated request',
    )
    .option(
      '--no-identity',
      'simulate Netlify Identity authentication JWT. pass --no-identity to affirm unauthenticated request',
    )
    .option('--port <port>', 'Port where netlify dev is accessible. e.g. 8888', (value) => Number.parseInt(value))
    .addExamples([
      'netlify functions:invoke',
      'netlify functions:invoke myfunction',
      'netlify functions:invoke --name myfunction',
      'netlify functions:invoke --name myfunction --identity',
      'netlify functions:invoke --name myfunction --no-identity',
      `netlify functions:invoke myfunction --payload '{"foo": 1}'`,
      'netlify functions:invoke myfunction --querystring "foo=1',
      'netlify functions:invoke myfunction --payload "./pathTo.json"',
    ])
    .action(async (nameArgument, options, command) => {
      const { functionsInvoke } = await import('./functions-invoke.mjs')
      await functionsInvoke(nameArgument, options, command)
    })

/**
 * Creates the `netlify functions:list` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsListCommand = (program) =>
  program
    .command('functions:list')
    .alias('function:list')
    .description(
      `List functions that exist locally
Helpful for making sure that you have formatted your functions correctly

NOT the same as listing the functions that have been deployed. For that info you need to go to your Netlify deploy log.`,
    )
    .option('-f, --functions <dir>', 'Specify a functions directory to list')
    .option('--json', 'Output function data as JSON')
    .hook('preAction', requiresSiteInfo)
    .action(async (options, command) => {
      const { functionsList } = await import('./functions-list.mjs')
      await functionsList(options, command)
    })

/**
 * Creates the `netlify functions:serve` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createFunctionsServeCommand = (program) =>
  program
    .command('functions:serve')
    .alias('function:serve')
    .description('Serve functions locally')
    .option('-f, --functions <dir>', 'Specify a functions directory to serve')
    .option('-p, --port <port>', 'Specify a port for the functions server', (value) => Number.parseInt(value))
    .option('-o, --offline', 'disables any features that require network access')
    .addHelpText('after', 'Helpful for debugging functions.')
    .action(async (options, command) => {
      const { functionsServe } = await import('./functions-serve.mjs')
      await functionsServe(options, command)
    })
