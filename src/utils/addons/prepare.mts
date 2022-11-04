// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'chalk'.
const { chalk, error, exit, log, warn } = require('../command-helpers.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'ADDON_VALI... Remove this comment to see the full error message
const ADDON_VALIDATION = {
  EXISTS: 'EXISTS',
  NOT_EXISTS: 'NOT_EXISTS',
}

const validateExists = ({
  addon,
  addonName,
  siteData
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  if (!addon || !addon.id) {
    log(`Add-on ${addonName} doesn't exist for ${siteData.name}`)
    log(`> Run \`netlify addons:create ${addonName}\` to create an instance for this site`)
    exit(1)
  }
}

const validateNotExists = ({
  addon,
  addonName,
  siteData
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  if (addon && addon.id) {
    log(`The "${addonName} add-on" already exists for ${siteData.name}`)
    log()
    const cmd = chalk.cyan(`\`netlify addons:config ${addonName}\``)
    log(`- To update this add-on run: ${cmd}`)
    const deleteCmd = chalk.cyan(`\`netlify addons:delete ${addonName}\``)
    log(`- To remove this add-on run: ${deleteCmd}`)
    log()
    exit(1)
  }
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getCurrent... Remove this comment to see the full error message
const getCurrentAddon = ({
  addonName,
  addons
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => addons.find((addon: $TSFixMe) => addon.service_slug === addonName)

const validateCurrentAddon = ({
  addon,
  addonName,
  siteData,
  validation
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  switch (validation) {
    case ADDON_VALIDATION.EXISTS: {
      validateExists({ addon, addonName, siteData })
      break
    }
    case ADDON_VALIDATION.NOT_EXISTS: {
      validateNotExists({ addon, addonName, siteData })
      break
    }
    default: {
      warn(`Unknown addons validation: ${validation}`)
      break
    }
  }
}

const getAddonManifest = async ({
  addonName,
  api
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  let manifest
  try {
    manifest = await api.showServiceManifest({ addonName })
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    if (typeof (error_ as $TSFixMe).message === 'string' && (error_ as $TSFixMe).message.includes('Not Found')) {
      error(`No add-on "${addonName}" found. Please double check your add-on name and try again`)
    } else {
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      error((error_ as $TSFixMe).message);
    }
  }
  return manifest
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getSiteDat... Remove this comment to see the full error message
const getSiteData = async ({
  api,
  siteId
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  let siteData
  try {
    siteData = await api.getSite({ siteId })
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    error(`Failed getting list of site data: ${(error_ as $TSFixMe).message}`);
  }
  return siteData
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getAddons'... Remove this comment to see the full error message
const getAddons = async ({
  api,
  siteId
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  let addons
  try {
    addons = await api.listServiceInstancesForSite({ siteId })
  } catch (error_) {
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    error(`Failed getting list of addons: ${(error_ as $TSFixMe).message}`);
  }
  return addons
}

/**
 *
 * @param {object} config
 * @param {import('../../commands/base-command').BaseCommand} config.command
 * @param {string} [config.addonName]
 * @param {keyof ADDON_VALIDATION} [config.validation]
 */
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'prepareAdd... Remove this comment to see the full error message
const prepareAddonCommand = async ({
  addonName,
  command,
  validation
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  const { netlify } = command
  const { api, site } = netlify
  const siteId = site.id
  if (!siteId) {
    error('No site id found, please run inside a site folder or `netlify link`')
  }

  await command.authenticate()

  const [manifest, siteData, addons] = await Promise.all([
    // TODO: check as `getAddonManifest` did not accept a parameter error
    addonName ? getAddonManifest({ api, addonName, error }) : Promise.resolve(),
    getSiteData({ api, siteId }),
    getAddons({ api, siteId }),
  ])

  let addon
  if (addonName) {
    addon = getCurrentAddon({ addons, addonName })
    validateCurrentAddon({ addon, validation, addonName, siteData })
  }

  return { manifest, addons, addon, siteData }
}

module.exports = { ADDON_VALIDATION, prepareAddonCommand, getAddonManifest, getSiteData, getAddons, getCurrentAddon }
