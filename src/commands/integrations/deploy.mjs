import { getToken, chalk, log } from '../../utils/command-helpers.mjs'
import { checkOptions } from '../build/build.mjs'
import { build as SdkBuild } from '@netlify/sdk/commands'
import { getConfiguration } from '@netlify/sdk/cli-utils'
import { getBuildOptions } from '../../lib/build.mjs'
import { getSiteInformation } from '../../utils/dev.mjs'
import { resolve } from "path";

import fs from 'fs-extra'
import fetch from 'node-fetch'
import yaml from 'js-yaml'


const INTEGRATION_URL = process.env.INTEGRATION_URL || 'https://api.netlifysdk.com'

/**
 * The deploy command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 * * @param {import('../base-command.mjs').default} command
 */
const deploy = async (options, command) => {
  // Need to check for a linked site (see the 'checkOptions' in the build/build.mjs file for how to check for a token and linked site)
  const { api, cachedConfig, site, siteInfo } = command.netlify
  const {id: siteId} = site
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

  const { accountId } = await getSiteInformation({
    api,
    site,
    siteInfo,
  })

  const integration = await fetch(`${INTEGRATION_URL}/${accountId}/integrations?site_id=${siteId}`, {
    headers: {
      "netlify-token": token
    }
  }).then(res => res.json())
  
  const { name, description, scopes, slug } = getConfiguration();

  if (slug != integration.slug) {
    // Update the project's integration.yaml file with the Jigsaw slug since that will
    // be considered the source of truth.
    // Let the user know they need to commit and push the changes.
    const updatedSlug = integration.slug;
    const updatedIntegrationConfig = yaml.dump({ config: {name, description, scopes, slug: updatedSlug }})
    const filePath = resolve(process.cwd(), 'integration.yaml')
    await fs.writeFile(filePath, updatedIntegrationConfig)
    log(chalk.green(`Updated the integration.yaml file with the slug ${updatedSlug}. Please commit and push the changes.`))
  }

  // If the integration already exists in Jigsaw and the fields differ from what we're seeing (particularly 'scopes'),
  // then we need to prompt the user to confirm that they want to update them

  
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
