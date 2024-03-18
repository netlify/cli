import { env } from 'process';
import { Option } from 'commander';
export const createDeployCommand = (program) => program
    .command('deploy')
    .description(`Create a new deploy from the contents of a folder
Deploys from the build settings found in the netlify.toml file, or settings from the API.

The following environment variables can be used to override configuration file lookups and prompts:

- \`NETLIFY_AUTH_TOKEN\` - an access token to use when authenticating commands. Keep this value private.
- \`NETLIFY_SITE_ID\` - override any linked site in the current working directory.

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

Build dependency bundled Node.js lambda functions with tools like netlify-lambda, webpack or browserify into the function folder as part of your build process.

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
    .option('-p, --prod', 'Deploy to production', false)
    .addOption(new Option('--prodIfUnlocked', 'Old, prefer --prod-if-unlocked. Deploy to production if unlocked, create a draft otherwise')
    .default(false)
    .hideHelp(true))
    .option('--prod-if-unlocked', 'Deploy to production if unlocked, create a draft otherwise', false)
    .option('--alias <name>', 'Specifies the alias for deployment, the string at the beginning of the deploy subdomain. Useful for creating predictable deployment URLs. Avoid setting an alias string to the same value as a deployed branch. `alias` doesn’t create a branch deploy and can’t be used in conjunction with the branch subdomain feature. Maximum 37 characters.')
    .option('-b, --branch <name>', 'Serves the same functionality as --alias. Deprecated and will be removed in future versions')
    .option('-o, --open', 'Open site after deploy', false)
    .option('-m, --message <message>', 'A short message to include in the deploy log')
    .option('-a, --auth <token>', 'Netlify auth token to deploy with', env.NETLIFY_AUTH_TOKEN)
    .option('-s, --site <name-or-id>', 'A site name or ID to deploy to', env.NETLIFY_SITE_ID)
    .option('--json', 'Output deployment data as JSON')
    .option('--timeout <number>', 'Timeout to wait for deployment to finish', (value) => Number.parseInt(value))
    .option('--trigger', 'Trigger a new build of your site on Netlify without uploading local files')
    .option('--build', 'Run build command before deploying')
    .option('--context <context>', 'Context to use when resolving build configuration')
    .option('--skip-functions-cache', 'Ignore any functions created as part of a previous `build` or `deploy` commands, forcing them to be bundled again as part of the deployment', false)
    .addExamples([
    'netlify deploy',
    'netlify deploy --site my-first-site',
    'netlify deploy --prod',
    'netlify deploy --prod --open',
    'netlify deploy --prod-if-unlocked',
    'netlify deploy --message "A message with an $ENV_VAR"',
    'netlify deploy --auth $NETLIFY_AUTH_TOKEN',
    'netlify deploy --trigger',
    'netlify deploy --build --context deploy-preview',
])
    .action(async (options, command) => {
    const { deploy } = await import('./deploy.js');
    await deploy(options, command);
});
