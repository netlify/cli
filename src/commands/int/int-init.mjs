import { log } from '../../utils/command-helpers.mjs'

/**
 * The init command for Netlify Integrations
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const init = async (options, command) => {
  log('init command worked!')
}

/**
 * Creates the `netlify int init` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createInitCommand = (program) => {
  return program
    .command('init')
    .description('Creates a skeleton Netlify integration project in your current directory.')
    .action(init)
}
