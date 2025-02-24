import { picocolors } from '../command-helpers.js'

export const destructiveCommandMessages = {
  overwriteNotice: `${picocolors.yellowBright(
    'Notice',
  )}: To overwrite without this warning, you can use the --force flag.`,

  blobSet: {
    generateWarning: (key: string, storeName: string) =>
      `${picocolors.redBright('Warning')}: The blob key ${picocolors.cyan(
        key,
      )} already exists in store ${picocolors.cyan(storeName)}!`,
    overwriteConfirmation: 'Do you want to proceed with overwriting this blob key existing value?',
  },

  blobDelete: {
    generateWarning: (key: string, storeName: string) =>
      `${picocolors.redBright('Warning')}: The following blob key ${picocolors.cyan(
        key,
      )} will be deleted from store ${picocolors.cyan(storeName)}!`,
    overwriteConfirmation: 'Do you want to proceed with deleting the value at this key?',
  },

  envSet: {
    generateWarning: (variableName: string) =>
      `${picocolors.redBright('Warning')}: The environment variable ${picocolors.bgBlueBright(
        variableName,
      )} already exists!`,
    overwriteConfirmation: 'Do you want to overwrite it?',
  },

  envUnset: {
    generateWarning: (variableName: string) =>
      `${picocolors.redBright('Warning')}: The environment variable ${picocolors.bgBlueBright(
        variableName,
      )} will be removed from all contexts!`,
    overwriteConfirmation: 'Do you want to remove it?',
  },

  envClone: {
    generateWarning: (siteId: string) =>
      `${picocolors.redBright(
        'Warning',
      )}: The following environment variables are already set on the site with ID ${picocolors.bgBlueBright(
        siteId,
      )}. They will be overwritten!`,
    noticeEnvVars: `${picocolors.yellowBright('Notice')}: The following variables will be overwritten:`,
    overwriteConfirmation: 'The environment variables already exist. Do you want to overwrite them?',
  },
}
