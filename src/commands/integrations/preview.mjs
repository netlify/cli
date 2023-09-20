/* eslint-disable import/extensions */
import { preview as SdkPreview } from '@netlify/sdk/commands'

/**
 * The preview command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 */
const preview = async (options) => {
  await SdkPreview(options)
}

/**
 * Creates the `netlify int preview` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createPreviewCommand = (program) =>
  program
    .command('preview')
    .description('Preview the UI of the Netlify Integration in your local environment.')
    .action(preview)
/* eslint-enable import/extensions */
