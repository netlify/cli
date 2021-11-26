/**
 * The build command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const build = async (options, command) => {
  console.log('build command with options', options)
}

/**
 * Creates the `netlify build` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createBuildCommand = (program) =>
  program
    .command('build')
    .description('(Beta) Build on your local machine')
    .action(build)

module.exports = { createBuildCommand }
