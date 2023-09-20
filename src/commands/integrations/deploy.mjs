import { getToken, chalk, log } from '../../utils/command-helpers.mjs'
import { checkOptions } from '../build/build.mjs'
import { build as SdkBuild } from '@netlify/sdk/commands'
import { getConfiguration } from '@netlify/sdk/cli-utils'
import { getBuildOptions } from '../../lib/build.mjs'
import { getSiteInformation } from '../../utils/dev.mjs'
import { resolve } from "path";
import { deploy as siteDeploy } from '../deploy/deploy.mjs'

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

function logScopeConfirmationMessage(localScopes, remoteScopes) {
  log(chalk.yellow(`This integration is already registered. The current required scopes are:`))
  for (const scope of remoteScopes) {
    log(chalk.green(`- ${scope}`))
  }
  log(chalk.yellow("and will be updated to:"))
  for (const scope of localScopes) {
    log(chalk.green(`- ${scope}`))
  }
  log(chalk.yellow("if you continue. This will only affect future installations of the integration."));
}

function formatScopesToWrite(registeredIntegrationScopes) {
  let scopesToWrite = {}

  for (const i = 0; i < registeredIntegrationScopes.length; i++) {
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
  return scopesToWrite
}

function formatScopesForRemote(scopes) {
  let scopesToWrite = []
  if (scopes.all) {
    scopesToWrite.push('all')
  } else {
    const scopeResources = Object.keys(scopes)
    scopeResources.forEach((resource) => {
      const permissionsRequested = scopes[resource]
      permissionsRequested.forEach((permission) => scopesToWrite.push(`${resource}:${permission}`))
    })
  }
  return scopesToWrite.join(',')
}

function verifyRequiredFieldsAreInConfig(name, description, scopes) {
  if (!name) {
    log(chalk.yellow(`The integration name is required. Please add a 'name' entry to the integration.yaml file and try again.`))
    return false
  }
  if (!description) {
    log(chalk.yellow(`The integration description is required. Please add a 'description' entry to the integration.yaml file and try again.`))
    return false
  }
  if (!scopes) {
    log(chalk.yellow(`Permission scopes needed for the integration to function are required. Please add a 'scopes' entry to the integration.yaml file and try again.`))
    return false
  }
  return true
}

async function registerIntegration(siteId, accountId, localIntegrationConfig, token) {
  const { name, description, scopes, slug } = localIntegrationConfig
  log(chalk.yellow(`An integration associated with the site ID ${siteId} is not registered.`))
  const registerPrompt = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'registerIntegration',
      message: `Would you like to register a private integration for this site now?`,
      default: false,
    },
  ])

  if (!registerPrompt.registerIntegration) {
    log(chalk.white("Cancelling deployment. Please run 'netlify int deploy' again when you are ready to register the integration."))
    log(chalk.white("You can also register the integration through the Netlify UI on the 'Integrations' > 'Create private integration' page"))
    return;
  }

  if (!verifyRequiredFieldsAreInConfig(name, description, scopes)) {
    return;
  }

  log(chalk.white("Registering the integration..."))

  const { body, statusCode } = await fetch(`${INTEGRATION_URL}/${accountId}/integrations`, {
    method: "POST",
    headers: {
      "netlify-token": token
    },
    body: JSON.stringify({
      name,
      slug,
      description,
      hostSiteId: siteId,
      scopes: formatScopesForRemote(scopes),
    })
  }).then(async (res) => {
    const body = await res.json()
    return { body, statusCode: res.status }
  })

  if (statusCode !== 201) {
    log(chalk.red(`There was an error registering the integration:`))
    log()
    log(chalk.red(`-----------------------------------------------`))
    log(chalk.red(body.msg))
    log(chalk.red(`-----------------------------------------------`))
    log()
    log(chalk.red(`Please try again. If the problem persists, please contact support.`))
    return;
  }

  log(chalk.green(`Successfully registered the integration with the slug: ${body.slug}`))

  const updatedIntegrationConfig = yaml.dump({ config: { name, description, slug: body.slug, scopes } })

  const filePath = resolve(process.cwd(), 'integration.yaml')
  await fs.writeFile(filePath, updatedIntegrationConfig)

  log(chalk.yellow("Your integration.yaml file has been updated. Please commit and push these changes."));
}


/**
 * The deploy command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 * * @param {import('../base-command.mjs').default} command
 */
const deploy = async (options, command) => {
  const { api, cachedConfig, site, siteInfo } = command.netlify
  const { id: siteId } = site
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

  const { body: registeredIntegration, statusCode } = await fetch(`${INTEGRATION_URL}/${accountId}/integrations?site_id=${siteId}`, {
    headers: {
      "netlify-token": token
    }
  }).then(async (res) => {
    const body = await res.json()
    return { body, statusCode: res.status }
  })


  let { name, description, scopes, slug } = await getConfiguration()
  let integrationSlug = slug
  const localIntegrationConfig = { name, description, scopes, slug }

  // The integration isn't registered on the remote
  if (statusCode !== 200) {
    await registerIntegration(siteId, accountId, localIntegrationConfig, token)
    // log(chalk.yellow(`An integration associated with the site ID ${siteId} is not registered.`))
    // const registerPrompt = await inquirer.prompt([
    //   {
    //     type: 'confirm',
    //     name: 'registerIntegration',
    //     message: `Would you like to register a private integration for this site now?`,
    //     default: false,
    //   },
    // ])

    // if (!registerPrompt.registerIntegration) {
    //   log(chalk.white("Cancelling deployment. Please run 'netlify int deploy' again when you are ready to register the integration."))
    //   log(chalk.white("You can also register the integration through the Netlify UI on the 'Integrations' > 'Create private integration' page"))
    //   return;
    // }

    // if (!verifyRequiredFieldsAreInConfig(name, description, scopes)) {
    //   return;
    // }

    // log(chalk.white("Registering the integration..."))

    // const { body, statusCode } = await fetch(`${INTEGRATION_URL}/${accountId}/integrations`, {
    //   method: "POST",
    //   headers: {
    //     "netlify-token": token
    //   },
    //   body: JSON.stringify({
    //     name,
    //     slug,
    //     description,
    //     hostSiteId: siteId,
    //     scopes: formatScopesForRemote(scopes),
    //   })
    // }).then(async (res) => {
    //   const body = await res.json()
    //   return { body, statusCode: res.status }
    // })

    // if (statusCode !== 201) {
    //   log(chalk.red(`There was an error registering the integration:`))
    //   log()
    //   log(chalk.red(`-----------------------------------------------`))
    //   log(chalk.red(body.msg))
    //   log(chalk.red(`-----------------------------------------------`))
    //   log()
    //   log(chalk.red(`Please try again. If the problem persists, please contact support.`))
    //   return;
    // }

    // log(chalk.green(`Successfully registered the integration with the slug: ${body.slug}`))

    // const updatedIntegrationConfig = yaml.dump({ config: { name, description, slug: body.slug, scopes } })

    // const filePath = resolve(process.cwd(), 'integration.yaml')
    // await fs.writeFile(filePath, updatedIntegrationConfig)

    // log(chalk.yellow("Your integration.yaml file has been updated. Please commit and push these changes."));
  } else {
    // Updating the integration
    if (slug != registeredIntegration.slug) {
      // Update the project's integration.yaml file with the remote slug since that will
      // be considered the source of truth and is a value that can't be edited by the user.
      // Let the user know they need to commit and push the changes.
      integrationSlug = registeredIntegration.slug;
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
      logScopeConfirmationMessage(localScopes, registeredIntegrationScopes)

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
        const { _, statusCode } = await fetch(`${INTEGRATION_URL}/${accountId}/integrations/${integrationSlug}`, {
          method: 'PUT',
          headers: {
            "netlify-token": token
          },
          body: JSON.stringify({ name, description, hostSiteId: siteId, scopes: localScopes.join(',') })
        }).then(async res => {
          const body = await res.json()
          return { body, statusCode: res.status }
        })

        if (statusCode !== 200) {
          log(chalk.red(`There was an error updating the integration. Please try again. If the problem persists, please contact support.`))
          return;
        }
      } else {
        // Use the scopes that are already registered
        log(chalk.white("Saving the currently registered scopes to the integration.yaml file."));
        scopesToWrite = formatScopesToWrite(registeredIntegrationScopes)
      }

      const updatedIntegrationConfig = yaml.dump({ config: { name, description, slug: integrationSlug, scopes: scopesToWrite } })

      const filePath = resolve(process.cwd(), 'integration.yaml')
      await fs.writeFile(filePath, updatedIntegrationConfig)

      log(chalk.yellow("Changes to the integration.yaml file are complete. Please commit and push these changes."));
    }
  }

  // Deploy the integration to that site
  await siteDeploy(options, command)
}

/**
 * Creates the `netlify int deploy` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createDeployCommand = (program) => program
  .command('deploy')
  .description('Register, build and deploy a private Netlify integration.')
  .option('--build', 'Run build command before deploying')
  .option('-p, --prod', 'Deploy to production', false)
  .action(deploy)
