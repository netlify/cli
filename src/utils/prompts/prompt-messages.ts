import { chalk } from '../command-helpers.js'

export const destructiveCommandMessages = {
  overwriteNoticeMessage: `${chalk.yellowBright(
    'Notice',
  )}: To overwrite without this warning, you can use the --force flag.`,

  blobSet: {
    generateWarningMessage: (storeName: string) =>
      `${chalk.redBright('Warning')}: The blob key already exists in store ${chalk.cyan(storeName)}.`,
    overwriteConfirmationMessage: 'Do you want to proceed with overwriting this blob key existing value?',
  },

  blobDelete: {
    generateWarningMessage: (key: string, storeName: string) =>
      `${chalk.redBright('Warning')}: The following blob key ${chalk.cyan(key)} will be deleted from store ${chalk.cyan(
        storeName,
      )}:`,
    overwriteConfirmationMessage: 'Do you want to proceed with deleting the value at this key?',
  },

  envSet: {
    generateWarningMessage: (variableName: string) =>
      `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(variableName)} already exists.`,
    overwriteConfirmationMessage: 'The environment variable already exists. Do you want to overwrite it?',
  },

  envUnset: {
    generateWarningMessage: (variableName: string) =>
      `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(variableName)} already exists!`,
    overwriteConfirmationMessage: 'The environment variable already exists. Do you want to overwrite it?',
  },

  envClone: {
    generateWarningMessage: (siteId: string) =>
      `${chalk.redBright(
        'Warning',
      )}: The following environment variables are already set on the site with ID ${chalk.bgBlueBright(
        siteId,
      )}. They will be overwritten!`,
    noticeEnvVarsMessage: `${chalk.yellowBright('Notice')}: The following variables will be overwritten:`,
    overwriteConfirmationMessage: 'The environment variables already exist. Do you want to overwrite them?',
  },
}
