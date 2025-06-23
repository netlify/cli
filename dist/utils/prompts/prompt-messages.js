import { chalk } from '../command-helpers.js';
export const destructiveCommandMessages = {
    overwriteNotice: `${chalk.yellowBright('Notice')}: To overwrite without this warning, you can use the --force flag.`,
    blobSet: {
        generateWarning: (key, storeName) => `${chalk.redBright('Warning')}: The blob key ${chalk.cyan(key)} already exists in store ${chalk.cyan(storeName)}!`,
        overwriteConfirmation: 'Do you want to proceed with overwriting this blob key existing value?',
    },
    blobDelete: {
        generateWarning: (key, storeName) => `${chalk.redBright('Warning')}: The following blob key ${chalk.cyan(key)} will be deleted from store ${chalk.cyan(storeName)}!`,
        overwriteConfirmation: 'Do you want to proceed with deleting the value at this key?',
    },
    envSet: {
        generateWarning: (variableName) => `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(variableName)} already exists!`,
        overwriteConfirmation: 'Do you want to overwrite it?',
    },
    envUnset: {
        generateWarning: (variableName) => `${chalk.redBright('Warning')}: The environment variable ${chalk.bgBlueBright(variableName)} will be removed from all contexts!`,
        overwriteConfirmation: 'Do you want to remove it?',
    },
    envClone: {
        generateWarning: (siteId) => `${chalk.redBright('Warning')}: The following environment variables are already set on the project with ID ${chalk.bgBlueBright(siteId)}. They will be overwritten!`,
        noticeEnvVars: `${chalk.yellowBright('Notice')}: The following variables will be overwritten:`,
        overwriteConfirmation: 'The environment variables already exist. Do you want to overwrite them?',
    },
};
//# sourceMappingURL=prompt-messages.js.map