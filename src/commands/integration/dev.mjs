/* eslint-disable import/extensions */
import { dev as SdkDev } from '@netlify/sdk/commands'

/**
 * The dev command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 */
const dev = async (options) => {
  await SdkDev(options)
}

/**
 * Creates the `netlify int dev` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createDevCommand = (program) =>
  program.command('integration:dev').alias('int:dev').description('Build and preview the Netlify integration in your local environment.').action(dev)
/* eslint-enable import/extensions */
