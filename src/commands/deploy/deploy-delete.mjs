// @ts-check
import inquirer from 'inquirer'

import { chalk, error, exit, log } from '../../utils/command-helpers.mjs'

/**
 * The deploy:delete command
 * @param {string} deployId
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const deployDelete = async (deployId, options, command) => {
  command.setAnalyticsPayload({ force: options.force })

  const { api } = command.netlify

  let deploy
  try {
    deploy = await api.getDeploy({ deployId })
  } catch (error_) {
    if (error_.status === 404) {
      error(`No deploy with id ${deployId} found. Please verify the deployId & try again.`)
    }
  }

  if (!deploy) {
    error(`Unable to process deploy`)
  }

  const noForce = options.force !== true

  /* Verify the user wants to delete the site */
  if (noForce) {
    log(`${chalk.redBright('Warning')}: You are about to permanently delete a deploy`)
    log(`         Verify this deployID "${deployId}" supplied is correct and proceed.`)
    log('         To skip this prompt, pass a --force flag to the delete command')
    log()
    log(`${chalk.bold('Be careful here. There is no undo!')}`)
    log()
    const { wantsToDelete } = await inquirer.prompt({
      type: 'confirm',
      name: 'wantsToDelete',
      message: `WARNING: Are you sure you want to delete the following deploy "${deploy.id}"?`,
      default: false,
    })
    log()
    if (!wantsToDelete) {
      exit()
    }
  }

  try {
    await api.deleteDeploy({ deploy_id: deployId })
  } catch (error_) {
    if (error_.status === 404) {
      error(`No deploy with id ${deployId} found. Please verify the deployId & try again.`)
    } else {
      error(`Delete Deploy error: ${error_.status}: ${error_.message}`)
    }
  }
  log(`Deploy "${deployId}" successfully deleted!`)
}

/**
 * Creates the `netlify deploy:delete` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createDeployDeleteCommand = (program) =>
  program
    .command('deploy:delete')
    .description('Delete a deploy\nThis command will permanently delete a deploy on Netlify. Use with caution.')
    .argument('<deployId>', 'Deploy ID to delete')
    .option('-f, --force', 'delete without propting (useful for CI)')
    .addExamples(['netlify deploy:delete 12a3456b71234c56de789f12'])
    .action(deployDelete)
