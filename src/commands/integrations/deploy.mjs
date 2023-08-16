import { getToken } from '../../utils/command-helpers.mjs'
import { checkOptions } from '../build/build.mjs'
import { build as SdkBuild } from '@netlify/sdk/commands'


/**
 * The deploy command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 * * @param {import('../base-command.mjs').default} command
 */
const deploy = async (options, command) => {
  // Need to check for a linked site (see the 'checkOptions' in the build/build.mjs file for how to check for a token and linked site)
  const { cachedConfig, siteInfo } = command.netlify

  const [token] = await getToken()

  const buildOptions = await getBuildOptions({
    cachedConfig,
    packagePath: command.workspacePackage,
    token,
    options,
  })

  // Confirm that a site is linked and that the user is logged in
  checkOptions(buildOptions)

  // Todo: Support injecting env vars similar to what we do for normal sites/builds
  await SdkBuild({ all: true })

  // Read from the integration config schema for 'name', 'description', and 'scope' properties
  // Register the integration on Jigsaw if one doesn't exist with that slug (and obviously need to check ownership based on the user token) - 
  //    - likely need update the config file to support specifying scopes
  //    - Update the integration.yaml file with the correct slug that's returned from Jigsaw
  // Deploy the integration to that site
  // (In the create case) Notify the user that the `integration.yaml` was updated and that they need to commit and push the changes
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
