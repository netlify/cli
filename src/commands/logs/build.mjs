import inquirer from 'inquirer'
import WebSocket from 'ws'

import { chalk, error, log } from '../../utils/command-helpers.mjs'

export function getName(deploy) {
  switch (deploy.context) {
    case 'branch-deploy':
      return 'Branch Deploy'
    case 'deploy-preview': {
      // Deploys via the CLI can have the `deploy-preview` context
      // but no review id because they don't come from a PR.
      //
      const id = deploy.review_id
      return id ? `Deploy Preview #${id}` : 'Deploy Preview'
    }
    default:
      return 'Production'
  }
}

/**
 * The stream build logs command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const logsBuild = async (options, command) => {
  await command.authenticate()
  const client = command.netlify.api
  const { site } = command.netlify
  const { id: siteId } = site

  const deploys = await client.listSiteDeploys({ siteId, state: 'building' })

  if (deploys.length === 0) {
    log('No active builds')
    return
  }

  let [deploy] = deploys
  if (deploys.length > 1) {
    const { result } = await inquirer.prompt({
      name: 'result',
      type: 'list',
      message: 'Select a deploy',
      choices: deploys.map((d) => ({
        name: getName(d),
        value: d.id,
      })),
    })

    deploy = deploys.find((d) => d.id === result)
  }

  const { id } = deploy

  const ws = new WebSocket(`wss://socketeer.services.netlify.com/build/logs`)

  ws.on('open', function open() {
    ws.send(JSON.stringify({ deploy_id: id, site_id: siteId, access_token: client.accessToken }))
  })

  ws.on('message', (data) => {
    const { message } = JSON.parse(data)
    log(message)
  })

  ws.on('close', () => {
    log('Connection closed')
  })
}

/**
 * Creates the `netlify watch` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createLogsBuildCommand = (program) => program.command('logs:deploy').action(logsBuild)
