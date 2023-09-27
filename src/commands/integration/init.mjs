/* eslint-disable import/extensions */
import { init as SdkInit } from '@netlify/sdk/commands'

/**
 * The init command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 */
export const init = async (options) => {
  await SdkInit(options)
}

/**
 * Creates the `netlify int init` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createInitCommand = (program) =>
  program
    .command('integration:init')
    .alias('int:init')
    .description('Creates a skeleton Netlify integration project in your current directory.')
    .option('-s, --slug', 'The integration slug.')
    .action(init)
/* eslint-enable import/extensions */
