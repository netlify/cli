import { ansis } from '../command-helpers.js'

export const destructiveCommandMessages = {
  overwriteNotice: `${ansis.yellowBright('Notice')}: To overwrite without this warning, you can use the --force flag.`,

  blobSet: {
    generateWarning: (key: string, storeName: string) =>
      `${ansis.redBright('Warning')}: The blob key ${ansis.cyan(key)} already exists in store ${ansis.cyan(
        storeName,
      )}!`,
    overwriteConfirmation: 'Do you want to proceed with overwriting this blob key existing value?',
  },

  blobDelete: {
    generateWarning: (key: string, storeName: string) =>
      `${ansis.redBright('Warning')}: The following blob key ${ansis.cyan(key)} will be deleted from store ${ansis.cyan(
        storeName,
      )}!`,
    overwriteConfirmation: 'Do you want to proceed with deleting the value at this key?',
  },

  envSet: {
    generateWarning: (variableName: string) =>
      `${ansis.redBright('Warning')}: The environment variable ${ansis.bgBlueBright(variableName)} already exists!`,
    overwriteConfirmation: 'Do you want to overwrite it?',
  },

  envUnset: {
    generateWarning: (variableName: string) =>
      `${ansis.redBright('Warning')}: The environment variable ${ansis.bgBlueBright(
        variableName,
      )} will be removed from all contexts!`,
    overwriteConfirmation: 'Do you want to remove it?',
  },

  envClone: {
    generateWarning: (siteId: string) =>
      `${ansis.redBright(
        'Warning',
      )}: The following environment variables are already set on the site with ID ${ansis.bgBlueBright(
        siteId,
      )}. They will be overwritten!`,
    noticeEnvVars: `${ansis.yellowBright('Notice')}: The following variables will be overwritten:`,
    overwriteConfirmation: 'The environment variables already exist. Do you want to overwrite them?',
  },
}
