// @ts-check

const { isEmpty } = require('lodash')

const { log } = require('../../utils')

/**
 * The env:transfer command
 * @param {string} siteIdA Site (From)
 * @param {string} siteIdB Site (To)
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 * @returns {Promise<boolean>}
 */
const envTransfer = async (siteIdA, siteIdB, options, command) => {
  const { api, site } = command.netlify
  const siteId = {
    from: site.id || siteIdA,
    to: site.id ? siteIdA : siteIdB,
  }

  if (!siteId.to) {
    log(
      'Please include the site destination (siteIdB) as the second argument, or try to run this command again inside a site folder',
    )
    return false
  }

  const [siteFrom, siteTo] = await Promise.all([
    api.getSite({ siteId: siteId.from }),
    api.getSite({ siteId: siteId.to }),
  ])

  const [
    {
      build_settings: { env: envFrom = {} },
    },
    {
      build_settings: { env: envTo = {} },
    },
  ] = [siteFrom, siteTo]

  if (isEmpty(envFrom)) {
    log(`${siteFrom.name} has no environment variables, nothing to transfer`)
    return false
  }

  // Merge from site A to site B
  const mergedEnv = {
    ...envTo,
    ...envFrom,
  }

  // Apply environment variable updates
  await api.updateSite({
    siteId: siteId.to,
    body: {
      build_settings: {
        env: mergedEnv,
      },
    },
  })

  log(`Success transfer environment variables from "${siteFrom.name}" => "${siteTo.name}"`)
}

/**
 * Creates the `netlify env:transfer` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvTransferCommand = (program) =>
  program
    .command('env:transfer')
    .argument('<siteIdA>', 'Site ID (From)')
    .argument('[siteIdB]', 'Site ID (To)')
    .description(`Transfer environment variables from "siteIdA" to "siteIdB"`)
    .action(async (siteIdA, siteIdB, options, command) => {
      await envTransfer(siteIdA, siteIdB, options, command)
    })

module.exports = { createEnvTransferCommand }
