/* eslint-disable import/extensions */
import { preview as SdkPreview } from '@netlify/sdk/commands'

/**
 * The preview command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 */
export const preview = async (options) => {
  await SdkPreview(options)
}

/**
 * Creates the `netlify int preview` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createPreviewCommand = (program) =>
  program
    .command('integration:preview')
    .command('int:preview')
    .description('Preview the Integration UI of the integration in your local environment')
    .action(preview)
/* eslint-enable import/extensions */
