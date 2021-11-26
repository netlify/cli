/**
 * The env:get command
 * @param {string} name Environment variable name
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command').BaseCommand} command
 */
const envGet = async (name, options, command) => {
  await command.init()
  console.log('env:import command with options', options, name)

  console.log(command.netlify)
}

/**
 * Creates the `netlify env:get` command
 * @param {import('../base-command').BaseCommand} program
 * @returns
 */
const createEnvGetCommand = (program) =>
  program
    .command('env:get <name>')
    .description('Get resolved value of specified environment variable (includes netlify.toml)', {
      name: 'Environment variable name',
    })
    .action(envGet)

module.exports = { createEnvGetCommand }
