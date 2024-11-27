import fs from 'fs'
import process from 'process'
import { resolve } from 'path'
import { exit } from 'process'

import { OptionValues } from 'commander'
import inquirer from 'inquirer'
// @ts-expect-error TS(7016) FIXME: Could not find a declaration file for module 'js-y... Remove this comment to see the full error message
import yaml from 'js-yaml'
import fetch from 'node-fetch'
import { z } from 'zod'

import { getBuildOptions } from '../../lib/build.js'
import { chalk, getToken, log } from '../../utils/command-helpers.js'
import { getSiteInformation } from '../../utils/dev.js'
import BaseCommand from '../base-command.js'
import { checkOptions } from '../build/build.js'
import { deploy as siteDeploy } from '../deploy/deploy.js'

function getIntegrationAPIUrl() {
  return process.env.INTEGRATION_URL || 'https://api.netlifysdk.com'
}

// @ts-expect-error TS(7006) FIXME: Parameter 'localScopes' implicitly has an 'any' ty... Remove this comment to see the full error message
export function areScopesEqual(localScopes, remoteScopes) {
  if (localScopes.length !== remoteScopes.length) {
    return false
  }

  // @ts-expect-error TS(7006) FIXME: Parameter 'scope' implicitly has an 'any' type.
  return localScopes.every((scope) => remoteScopes.includes(scope))
}

// @ts-expect-error TS(7006) FIXME: Parameter 'localScopes' implicitly has an 'any' ty... Remove this comment to see the full error message
function logScopeConfirmationMessage(localScopes, remoteScopes) {
  log(chalk.yellow(`This integration is already registered. The current required scopes are:`))
  for (const scope of remoteScopes) {
    log(chalk.green(`- ${scope}`))
  }
  log(chalk.yellow('and will be updated to:'))
  for (const scope of localScopes) {
    log(chalk.green(`- ${scope}`))
  }
  log(chalk.yellow('if you continue. This will only affect future installations of the integration.'))
}

// @ts-expect-error TS(7006) FIXME: Parameter 'registeredIntegrationScopes' implicitly... Remove this comment to see the full error message
function formatScopesToWrite(registeredIntegrationScopes) {
  let scopesToWrite = {}

  for (const scope of registeredIntegrationScopes) {
    const [resource, permission] = scope.split(':')
    if (resource === 'all') {
      scopesToWrite = { all: true }
      break
    } else {
      // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (!scopesToWrite[resource]) {
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        scopesToWrite[resource] = []
      }
      // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      scopesToWrite[resource].push(permission)
    }
  }
  return scopesToWrite
}

// @ts-expect-error TS(7006) FIXME: Parameter 'scopes' implicitly has an 'any' type.
function formatScopesForRemote(scopes) {
  const scopesToWrite = []
  if (scopes.all) {
    scopesToWrite.push('all')
  } else {
    const scopeResources = Object.keys(scopes)
    scopeResources.forEach((resource) => {
      const permissionsRequested = scopes[resource]
      // @ts-expect-error TS(7006) FIXME: Parameter 'permission' implicitly has an 'any' typ... Remove this comment to see the full error message
      permissionsRequested.forEach((permission) => {
        scopesToWrite.push(`${resource}:${permission}`)
      })
    })
  }
  return scopesToWrite.join(',')
}

// @ts-expect-error TS(7006) FIXME: Parameter 'name' implicitly has an 'any' type.
function verifyRequiredFieldsAreInConfig(name, description, scopes) {
  const missingFields = []

  if (!name) {
    missingFields.push('name')
  }
  if (!description) {
    missingFields.push('description')
  }
  if (!scopes) {
    missingFields.push('scopes')
  }
  if (missingFields.length !== 0) {
    log(
      chalk.yellow(
        `You are missing the following fields for the integration to be deployed: ${missingFields.join(
          ', ',
        )}. Please add a these fields as an entry to the integration.yaml file and try again.`,
      ),
    )
    log(
      chalk.yellow(
        'For more information on the required fields, please see the documentation: https://ntl.fyi/create-private-integration',
      ),
    )
    return false
  }
  return true
}

// @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
export async function registerIntegration(workingDir, siteId, accountId, localIntegrationConfig, token) {
  const { description, name, scopes, slug } = localIntegrationConfig
  log(chalk.yellow(`An integration associated with the site ID ${siteId} is not registered.`))
  const registerPrompt = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'registerIntegration',
      message: `Would you like to register this site as a private integration now?`,
      default: false,
    },
  ])

  if (!registerPrompt.registerIntegration) {
    log(
      chalk.white(
        "Cancelling deployment. Please run 'netlify int deploy' again when you are ready to register the integration.",
      ),
    )
    log(
      chalk.white(
        "You can also register the integration through the Netlify UI on the 'Integrations' > 'Create private integration' page",
      ),
    )
    exit(1)
  }

  if (!verifyRequiredFieldsAreInConfig(name, description, scopes)) {
    exit(1)
  }

  log(chalk.white('Registering the integration...'))

  const { body, statusCode } = await fetch(`${getIntegrationAPIUrl()}/${accountId}/integrations`, {
    method: 'POST',
    headers: {
      'netlify-token': token,
    },
    body: JSON.stringify({
      name,
      slug,
      description,
      hostSiteId: siteId,
      scopes: formatScopesForRemote(scopes),
    }),
  }).then(async (res) => {
    const response = await res.json()
    return { body: response, statusCode: res.status }
  })

  if (statusCode !== 201) {
    log(chalk.red(`There was an error registering the integration:`))
    log()
    log(chalk.red(`-----------------------------------------------`))
    // @ts-expect-error TS(18046) - 'body' is of type 'unknown'
    log(chalk.red(body.msg))
    log(chalk.red(`-----------------------------------------------`))
    log()
    log(chalk.red(`Please try again. If the problem persists, please contact support.`))
    exit(1)
  }

  // @ts-expect-error TS(18046) - 'body' is of type 'unknown'
  log(chalk.green(`Successfully registered the integration with the slug: ${body.slug}`))

  const updatedIntegrationConfig = yaml.dump({
    // @ts-expect-error TS(18046) - 'body' is of type 'unknown'
    config: { name, description, slug: body.slug, scopes },
  })

  const filePath = resolve(workingDir, 'integration.yaml')
  await fs.promises.writeFile(filePath, updatedIntegrationConfig)

  log(chalk.yellow('Your integration.yaml file has been updated. Please commit and push these changes.'))
}

export async function updateIntegration(
  // @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
  workingDir,
  // @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
  options,
  // @ts-expect-error TS(7006) FIXME: Parameter 'siteId' implicitly has an 'any' type.
  siteId,
  // @ts-expect-error TS(7006) FIXME: Parameter 'accountId' implicitly has an 'any' type... Remove this comment to see the full error message
  accountId,
  // @ts-expect-error TS(7006) FIXME: Parameter 'localIntegrationConfig' implicitly has ... Remove this comment to see the full error message
  localIntegrationConfig,
  // @ts-expect-error TS(7006) FIXME: Parameter 'token' implicitly has an 'any' type.
  token,
  // @ts-expect-error TS(7006) FIXME: Parameter 'registeredIntegration' implicitly has a... Remove this comment to see the full error message
  registeredIntegration,
) {
  let { description, name, scopes, slug } = localIntegrationConfig

  let integrationSlug = slug
  if (slug !== registeredIntegration.slug) {
    // Update the project's integration.yaml file with the remote slug since that will
    // be considered the source of truth and is a value that can't be edited by the user.
    // Let the user know they need to commit and push the changes.
    integrationSlug = registeredIntegration.slug
  }

  if (!name) {
    // Disabling this lint rule because the destructuring was not assigning the variable correct and leading to a bug
    // eslint-disable-next-line prefer-destructuring
    name = registeredIntegration.name
  }

  if (!description) {
    // eslint-disable-next-line prefer-destructuring
    description = registeredIntegration.description
  }

  // This is returned as a comma separated string and will be easier to manage here as an array
  const registeredIntegrationScopes = registeredIntegration.scopes.split(',')

  const scopeResources = Object.keys(scopes)
  // @ts-expect-error TS(7034) FIXME: Variable 'localScopes' implicitly has type 'any[]'... Remove this comment to see the full error message
  let localScopes = []

  if (scopeResources.includes('all')) {
    localScopes = ['all']
  } else {
    scopeResources.forEach((resource) => {
      const permissionsRequested = scopes[resource]
      // @ts-expect-error TS(7006) FIXME: Parameter 'permission' implicitly has an 'any' typ... Remove this comment to see the full error message
      permissionsRequested.forEach((permission) => {
        localScopes.push(`${resource}:${permission}`)
      })
    })
  }

  // @ts-expect-error TS(7005) FIXME: Variable 'localScopes' implicitly has an 'any[]' t... Remove this comment to see the full error message
  if (!areScopesEqual(localScopes, registeredIntegrationScopes)) {
    // @ts-expect-error TS(7005) FIXME: Variable 'localScopes' implicitly has an 'any[]' t... Remove this comment to see the full error message
    logScopeConfirmationMessage(localScopes, registeredIntegrationScopes)

    const scopePrompt = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateScopes',
        message: `Do you want to update the scopes?`,
        default: false,
      },
    ])

    let scopesToWrite
    if (scopePrompt.updateScopes) {
      // Update the scopes in remote
      scopesToWrite = scopes
      const { statusCode, updateResponse } = await fetch(
        `${getIntegrationAPIUrl()}/${accountId}/integrations/${integrationSlug}`,
        {
          method: 'PUT',
          headers: {
            'netlify-token': token,
          },
          body: JSON.stringify({
            name,
            description,
            hostSiteId: siteId,
            // @ts-expect-error TS(7005) FIXME: Variable 'localScopes' implicitly has an 'any[]' t... Remove this comment to see the full error message
            scopes: localScopes.join(','),
          }),
        },
      ).then(async (res) => {
        const response = await res.json()
        return { updateResponse: response, statusCode: res.status }
      })

      if (statusCode !== 200) {
        log(
          chalk.red(`There was an error updating the integration: ${updateResponse}`),
          chalk.red('Please try again. If the problem persists, please contact support.'),
        )
        exit(1)
      }
    } else {
      const useRegisteredScopesPrompt = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'useRegisteredScopes',
          message: `Do you want to save the scopes registered for your integration in your local configuration file?`,
          default: false,
        },
      ])

      if (useRegisteredScopesPrompt.useRegisteredScopes) {
        // Use the scopes that are already registered
        log(chalk.white('Saving the currently registered scopes to the integration.yaml file.'))
        scopesToWrite = formatScopesToWrite(registeredIntegrationScopes)
      }

      if (!useRegisteredScopesPrompt.useRegisteredScopes && options.prod) {
        log(chalk.red('Unable to deploy your integration to production without updating the registered scopes.'))
        exit(1)
      }
    }

    const updatedIntegrationConfig = yaml.dump({
      config: { name, description, slug: integrationSlug, scopes: scopesToWrite },
    })

    const filePath = resolve(workingDir, 'integration.yaml')
    await fs.promises.writeFile(filePath, updatedIntegrationConfig)

    log(chalk.yellow('Changes to the integration.yaml file are complete. Please commit and push these changes.'))
  }
}

const possibleFiles = ['integration.yaml', 'integration.yml', 'integration.netlify.yaml', 'integration.netlify.yml']
const IntegrationConfigurationSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().regex(/^[a-z\d-]+$/, 'slug must be lowercase with dashes'),
  scopes: z
    .object({
      all: z.boolean().optional(),
      site: z.array(z.enum(['read', 'write'])).optional(),
      env: z.array(z.enum(['read', 'write', 'delete'])).optional(),
      user: z.array(z.enum(['read', 'write'])).optional(),
    })
    .optional(),
})

// @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
const getConfigurationFile = (workingDir) => {
  const pwd = workingDir

  const fileName = possibleFiles.find((configFileName) => fs.existsSync(resolve(pwd, configFileName)))

  return fileName
}

// @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
export const getConfiguration = (workingDir) => {
  const pwd = workingDir

  const fileName = getConfigurationFile(workingDir)

  if (!fileName) {
    throw new Error('No configuration file found')
  }

  try {
    const { config } = yaml.load(fs.readFileSync(resolve(pwd, fileName), 'utf-8'))

    if (!config) {
      throw new Error('No configuration found')
    }

    const parseResult = IntegrationConfigurationSchema.safeParse(config)

    if (!parseResult.success) {
      console.error(parseResult.error.message)
      throw new Error('Invalid Configuration')
    }

    return config
  } catch (error) {
    console.error(error)
    console.error(`No configuration found in ${fileName} in ${pwd}`)
    exit(1)
  }
}

export const deploy = async (options: OptionValues, command: BaseCommand) => {
  const { api, cachedConfig, site, siteInfo } = command.netlify
  const { id: siteId } = site
  const [token] = await getToken()
  const workingDir = resolve(command.workingDir)
  const buildOptions = await getBuildOptions({
    cachedConfig,
    packagePath: command.workspacePackage,
    currentDir: command.workingDir,
    token,
    // @ts-expect-error TS(2740)
    options,
  })

  // Confirm that a site is linked and that the user is logged in
  checkOptions(buildOptions)

  const { description, name, scopes, slug } = await getConfiguration(command.workingDir)
  const localIntegrationConfig = { name, description, scopes, slug }

  const headers = token ? { 'netlify-token': token } : undefined
  // @ts-expect-error TS(2345) FIXME: Argument of type '{ api: any; site: any; siteInfo:... Remove this comment to see the full error message
  const { accountId } = await getSiteInformation({
    api,
    site,
    siteInfo,
  })

  const { body: registeredIntegration, statusCode } = await fetch(
    `${getIntegrationAPIUrl()}/${accountId}/integrations?site_id=${siteId}`,
    {
      headers,
    },
  ).then(async (res) => {
    const body = await res.json()
    return { body, statusCode: res.status }
  })

  // The integration is registered on the remote
  statusCode === 200
    ? await updateIntegration(
        workingDir,
        options,
        siteId,
        accountId,
        localIntegrationConfig,
        token,
        registeredIntegration,
      )
    : await registerIntegration(workingDir, siteId, accountId, localIntegrationConfig, token)

  // Set the prod flag to true if the integration is being initially registered because we don't want the user
  // to be in a weird state where the card is appearing in the integrations list but there's no production
  // version of the integration deployed
  options = statusCode === 200 ? options : { ...options, prod: true }

  // Deploy the integration to that site
  await siteDeploy(options, command)

  log(
    `${chalk.cyanBright.bold(
      `Your integration has been deployed. Next step is to enable it for a team or site.`,
    )} https://ntl.fyi/create-private-integration`,
  )
}
