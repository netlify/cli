

/**
 * The deploy command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 */
const deploy = async (options) => {
  // Need to check for a linked site (see the 'checkOptions' in the build/build.mjs file for how to check for a token and linked site)
  // Build the integration with the '-a' flag
  // Need CLI prompts for 'name' and 'description' properties
  // Register the integration on Jigsaw - likely need update the config file to support specifying scopes
  // Deploy the integration to that site
}

/**
 * Creates the `netlify int deploy` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createDeployCommand = (program) => program
    .command('deploy')
    .description('Build and deploy a private Netlify integration.')
    .action(deploy)
