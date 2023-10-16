/* eslint-disable import/extensions */
import { build as SdkBuild } from '@netlify/sdk/commands'

/**
 * The build command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 */
export const build = async (options) => {
  await SdkBuild(options)
}

/**
 * Creates the `netlify int build` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createBuildCommand = (program) =>
  program
    .command('integration:build')
    .alias('int:build')
    .description('Builds the integration')
    .option('-a, --all', 'Build all components of the integration', false)
    .option('-c, --connector', 'Build the Netlify Connect plugin of the integration', false)
    .option('-w, --watch', 'Build integration and then watch for changes', false)
    .option('-b, --buildtime', 'Build the build time component of the integration', false)
    .option('-s, --site', 'Build the serverless component of the integration', false)
    .action(build)
/* eslint-enable import/extensions */
