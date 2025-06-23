import { env } from 'process';
import { Option } from 'commander';
import terminalLink from 'terminal-link';
import { chalk, logAndThrowError, warn } from '../../utils/command-helpers.js';
export const createDeployCommand = (program) => program
    .command('deploy')
    .description(`Create a new deploy from the contents of a folder
Deploys from the build settings found in the netlify.toml file, or settings from the API.

The following environment variables can be used to override configuration file lookups and prompts:

- \`NETLIFY_AUTH_TOKEN\` - an access token to use when authenticating commands. Keep this value private.
- \`NETLIFY_SITE_ID\` - override any linked project in the current working directory.

Lambda functions in the function folder can be in the following configurations for deployment:


Built Go binaries:
------------------

\`\`\`
functions/
└── nameOfGoFunction
\`\`\`

Build binaries of your Go language functions into the functions folder as part of your build process.


Single file Node.js functions:
-----------------------------

Build dependency bundled Node.js lambda functions with tools like webpack or browserify into the function folder as part of your build process.

\`\`\`
functions/
└── nameOfBundledNodeJSFunction.js
\`\`\`

Unbundled Node.js functions that have dependencies outside or inside of the functions folder:
---------------------------------------------------------------------------------------------

You can ship unbundled Node.js functions with the CLI, utilizing top level project dependencies, or a nested package.json.
If you use nested dependencies, be sure to populate the nested node_modules as part of your build process before deploying using npm or yarn.

\`\`\`
project/
├── functions
│   ├── functionName/
│   │   ├── functionName.js  (Note the folder and the function name need to match)
│   │   ├── package.json
│   │   └── node_modules/
│   └── unbundledFunction.js
├── package.json
├── netlify.toml
└── node_modules/
\`\`\`

Any mix of these configurations works as well.


Node.js function entry points
-----------------------------

Function entry points are determined by the file name and name of the folder they are in:

\`\`\`
functions/
├── aFolderlessFunctionEntrypoint.js
└── functionName/
  ├── notTheEntryPoint.js
  └── functionName.js
\`\`\`

Support for package.json's main field, and intrinsic index.js entrypoints are coming soon.`)
    .option('-d, --dir <path>', 'Specify a folder to deploy')
    .option('-f, --functions <folder>', 'Specify a functions folder to deploy')
    .addOption(new Option('-p, --prod', 'Deploy to production')
    .default(false)
    .conflicts(['alias', 'branch', 'prod-if-unlocked']))
    .addOption(new Option('--prod-if-unlocked', 'Deploy to production if unlocked, create a draft otherwise')
    .default(false)
    .conflicts(['alias', 'branch', 'prod']))
    .option('--alias <name>', 'Specifies the alias for deployment, the string at the beginning of the deploy subdomain. Useful for creating predictable deployment URLs. Avoid setting an alias string to the same value as a deployed branch. `alias` doesn’t create a branch deploy and can’t be used in conjunction with the branch subdomain feature. Maximum 37 characters.')
    .addOption(new Option('-b, --branch <name>', 'Do not use - renamed to --alias.').hideHelp(true))
    .option('-O, --open', 'Open project after deploy', false)
    .option('-m, --message <message>', 'A short message to include in the deploy log')
    .option('-s, --site <name-or-id>', 'A project name or ID to deploy to', env.NETLIFY_SITE_ID)
    .option('--json', 'Output deployment data as JSON')
    .option('--timeout <number>', 'Timeout to wait for deployment to finish', (value) => Number.parseInt(value))
    .addOption(new Option('--trigger', 'Trigger a new build of your project on Netlify without uploading local files').conflicts('build'))
    .addOption(new Option('--build', 'Do not use - this is now the default. Will be removed in future versions.')
    .default(true)
    .hideHelp(true))
    /**
     * Note that this has special meaning to commander. It negates the above `build` option.
     * @see https://github.com/tj/commander.js/tree/83c3f4e391754d2f80b179acc4bccc2d4d0c863d?tab=readme-ov-file#other-option-types-negatable-boolean-and-booleanvalue
     */
    .option('--no-build', 'Do not run build command before deploying. Only use this if you have no need for a build or your project has already been built.')
    .option('--context <context>', 'Specify a deploy context for environment variables read during the build (”production”, ”deploy-preview”, ”branch-deploy”, ”dev”) or `branch:your-branch` where `your-branch` is the name of a branch (default: dev)')
    .option('--skip-functions-cache', 'Ignore any functions created as part of a previous `build` or `deploy` commands, forcing them to be bundled again as part of the deployment', false)
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
])
    .addHelpText('after', () => {
    const docsUrl = 'https://docs.netlify.com/site-deploys/overview/';
    return `
For more information about Netlify deploys, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
})
    .action(async (options, command) => {
    if (options.build && command.getOptionValueSource('build') === 'cli') {
        warn(`${chalk.cyanBright('--build')} is now the default and can safely be omitted.`);
    }
    if (options.branch) {
        warn('--branch flag has been renamed to --alias');
    }
    if (options.context && !options.build) {
        return logAndThrowError('--context flag is only available when using the --build flag');
    }
    const { deploy } = await import('./deploy.js');
    await deploy(options, command);
});
//# sourceMappingURL=index.js.map