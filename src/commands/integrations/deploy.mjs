import { getToken, chalk, log } from '../../utils/command-helpers.mjs'
import { checkOptions } from '../build/build.mjs'
import { build as SdkBuild } from '@netlify/sdk/commands'
import { getConfiguration } from '@netlify/sdk/cli-utils'
import { getBuildOptions } from '../../lib/build.mjs'
import { getSiteInformation } from '../../utils/dev.mjs'
import { resolve } from "path";

import inquirer from 'inquirer'
import fs from 'fs-extra'
import fetch from 'node-fetch'
import yaml from 'js-yaml'


const INTEGRATION_URL = process.env.INTEGRATION_URL || 'https://api.netlifysdk.com'

function areScopesEqual(localScopes, remoteScopes) {
  if (localScopes.length !== remoteScopes.length) {
    return false
  }

  return localScopes.every((scope) => remoteScopes.includes(scope))
}


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

  const registeredIntegration = await fetch(`${INTEGRATION_URL}/${accountId}/integrations?site_id=${siteId}`, {
    headers: {
      "netlify-token": token
    }
  }).then(res => res.json())
  
  let { name, description, scopes, slug } = await getConfiguration();

  let integrationSlug = slug
  if (!registeredIntegration) {
    // Create the integration in remote
  } else if (slug != registeredIntegration.slug) {
    // Update the project's integration.yaml file with the remote slug since that will
    // be considered the source of truth and is a value that can't be edited by the user.
    // Let the user know they need to commit and push the changes.
    integrationSlug = registeredIntegration.slug;

    log(chalk.green(`Updated the integration.yaml file with the slug that is registed for this integration: ${integrationSlug}.`))
  }

  if (!name) {
    name = registeredIntegration.name
  }

  if (!description) {
    description = registeredIntegration.description
  }

  // This is returned as a comma separated string and will be easier to manage here as an array
  const registeredIntegrationScopes = registeredIntegration.scopes.split(',');

  const scopeResources = Object.keys(scopes)
  let localScopes = []

  if (scopeResources.includes('all')) {
    localScopes = ['all']
  } else {
    scopeResources.forEach((resource) => {
      const permissionsRequested = scopes[resource]
      permissionsRequested.forEach((permission) => localScopes.push(`${resource}:${permission}`))
    })
  }

  if (!areScopesEqual(localScopes, registeredIntegrationScopes)) {
    log(chalk.yellow(`This integration is already registered. The current required scopes are:`))
    for (const scope of registeredIntegrationScopes) {
      log(chalk.green(`- ${scope}`))
    }
    log(chalk.yellow("and will be updated to:"))
    for (const scope of localScopes) {
      log(chalk.green(`- ${scope}`))
    }
    log(chalk.yellow("if you continue. This will only affect future installations of the integration."));
        
    const scopePrompt = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateScopes',
        message: `Do you want to update the scopes?`,
        default: false,
      },
    ])

    let scopesToWrite = null
    if (scopePrompt.updateScopes) {
      // Update the scopes in remote
      scopesToWrite = scopes
      const updatedIntegration = await fetch(`${INTEGRATION_URL}/${accountId}/integrations/${integrationSlug}`, {
        method: 'PUT',
        headers: {
          "netlify-token": token
        },
        body: JSON.stringify({ name, description, hostSiteId: siteId, scopes: localScopes.join(',') })
      }).then(res => res.json())

    } else {
      // Use the scopes that are already registered
      log(chalk.white("Saving the currently registered scopes to the integration.yaml file."));
      for (const i=0; i<registeredIntegrationScopes.length; i++) {
        const scope = registeredIntegrationScopes[i]
        const [resource, permission] = scope.split(':')
        if (resource === 'all') {
          scopesToWrite = { all: true }
          break;
        } else {
          if (!scopesToWrite[resource]) {
            scopesToWrite[resource] = []
          }
          scopesToWrite[resource].push(permission)
        }
      }
    }

    const updatedIntegrationConfig = yaml.dump({ config: {name, description, slug: integrationSlug, scopes: scopesToWrite }})

    const filePath = resolve(process.cwd(), 'integration.yaml')
    await fs.writeFile(filePath, updatedIntegrationConfig)

    log(chalk.yellow("Changes to the integration.yaml file are complete. Please commit and push these changes."));
  }
  
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
