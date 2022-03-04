// @ts-check
const { Option } = require('commander')
const inquirer = require('inquirer')
// eslint-disable-next-line no-unused-vars
const { GraphQL } = require('netlify-onegraph-internal')
const { OneGraphClient } = require('netlify-onegraph-internal')

const { getNetlifyGraphConfig } = require('../../lib/one-graph/cli-netlify-graph')
const { error, log } = require('../../utils')

const { importOperationHelper } = require('./import-operation-helper')

const getEnabledGraphServices = ({ state }) => state.get('oneGraphEnabledServices') || []

const filterOperationNames = (operationChoices, input) =>
  operationChoices.filter((operation) =>
    (operation.value.operationName || operation.value.fragmentName).toLowerCase().match(input.toLowerCase()),
  )

const filterServices = (servicesChoices, input) =>
  servicesChoices.filter((service) => service.value.friendlyServiceName.toLowerCase().match(input.toLowerCase()))

/**
 * Creates the `netlify graph:operations:sessionreset` command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns
 */
const graphOperationsSearch = async (options, command) => {
  // eslint-disable-next-line node/global-require
  const inquirerAutocompletePrompt = require('inquirer-autocomplete-prompt')
  /** multiple matching detectors, make the user choose */
  inquirer.registerPrompt('autocomplete', inquirerAutocompletePrompt)

  const { site, state } = command.netlify
  const netlifyToken = await command.authenticate()
  const netlifyGraphConfig = await getNetlifyGraphConfig({ command, options })
  const siteId = site.id

  const localServices = getEnabledGraphServices({ state })

  const first = 50
  const perPage = first

  let specifiedService

  if (options.service === true) {
    const result = await OneGraphClient.fetchListNetlifyEnabledServicesQuery({}, { siteId })

    const netlifyEnabledServices = result.data.oneGraph && result.data.oneGraph.services

    const allServicesChoices = netlifyEnabledServices.map((service) => {
      const name = service.friendlyServiceName
      return {
        name,
        value: service,
        short: name,
      }
    })

    if ((result.errors && result.errors.length !== 0) || !netlifyEnabledServices) {
      error(`Error fetching services for search prompt: ${JSON.stringify(result, null, 2)}`)
    }

    const { selectedService } = await inquirer.prompt({
      name: 'selectedService',
      message: `Which serice would you like to search for examples?`,
      // @ts-ignore
      type: 'autocomplete',
      pageSize: perPage,
      suffix: '',
      source(_, input) {
        if (!input || input === '') {
          return allServicesChoices
        }

        const filteredChoices = filterServices(allServicesChoices, input)
        // only show filtered results
        return filteredChoices
      },
    })

    if (!selectedService) {
      error(`No service selected, exiting...`)
    }

    specifiedService = selectedService.service
  } else if (options.service) {
    specifiedService = options.service
  }

  const services = specifiedService ? [specifiedService] : localServices

  const status = options.unpublished ? null : 'PUBLISHED'

  const searchInput = {
    nfToken: netlifyToken,
    first,
    status,
    services,
  }

  const result = await OneGraphClient.fetchListSharedDocumentsQuery(searchInput, {
    siteId,
  })

  const sharedDocuments =
    result.data &&
    result.data.oneGraph &&
    result.data.oneGraph.sharedDocuments &&
    result.data.oneGraph.sharedDocuments.nodes

  if (result.errors) {
    error(`Error searching operation: ${JSON.stringify(result, null, 2)}`)
  }

  if (!sharedDocuments) {
    error(`No documents returned for search, ${JSON.stringify(result, null, 2)}`)
  }

  const allOperationChoices = sharedDocuments.map((operation) => {
    const name = `${operation.operationName} [${operation.services
      .map((service) => service.friendlyServiceName)
      .join(', ')}]`
    return {
      name,
      value: operation,
      short: operation.operationName,
    }
  })

  const { selectedOperation } = await inquirer.prompt({
    name: 'selectedOperation',
    message: `Which operation would you like to import into your library?`,
    // @ts-ignore
    type: 'autocomplete',
    pageSize: perPage,
    suffix: '',
    source(_, input) {
      if (!input || input === '') {
        return allOperationChoices
      }

      const filteredChoices = filterOperationNames(allOperationChoices, input)
      // only show filtered results
      return filteredChoices
    },
  })

  if (!selectedOperation) {
    error(`No operation selected, exiting...`)
  }

  const { confirm } = await inquirer.prompt({
    name: 'confirm',
    message: `import operation ${selectedOperation.operationName}?

${selectedOperation.description}`,
    type: 'confirm',
  })

  if (!confirm) {
    log(`Exiting without importing operation`)
    return
  }

  let errorMessage = null

  importOperationHelper({
    error: (message) => {
      errorMessage = message
    },
    netlifyGraphConfig,
    operationId: selectedOperation.id,
    sharedDocument: selectedOperation,
    site,
    state,
  })

  if (errorMessage) {
    error(errorMessage)
  }
}

/**
 * Creates the `netlify graph:operations:search` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createGraphOperationsSearchCommand = (program) =>
  program
    .command('graph:operations:search')
    .description('Search for through published community operations to import into your library')
    .addOption(new Option('--unpublished', 'Include unpublished operations in search'))
    .addOption(new Option('--service [service]', 'Search for examples using a specific service'))
    .action(async (options, command) => {
      await graphOperationsSearch(options, command)
    })

module.exports = { createGraphOperationsSearchCommand }
