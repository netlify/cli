import { NetlifyAPI } from '@netlify/api'

import { log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { CLIENT_ID } from '../base-command.js'
import type { NetlifyOptions } from '../types.js'

export const loginRequest = async (message: string, apiOpts: NetlifyOptions['apiOpts']) => {
  const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'

  const api = new NetlifyAPI('', apiOpts)

  const ticket = await api.createTicket({ clientId: CLIENT_ID, body: { message } })

  if (!ticket.id) {
    return logAndThrowError('Failed to create login ticket')
  }
  const ticketId = ticket.id
  const url = `${webUI}/authorize?response_type=ticket&ticket=${ticketId}`

  logJson({
    ticket_id: ticketId,
    url,
    check_command: `netlify login --check ${ticketId}`,
    agent_next_steps:
      'Give the URL to the user so they can authorize. Then poll the check_command for up to ten minutes to see if the user has logged in, or wait for them to tell you and then use check_command after.',
  })

  log(`Ticket ID: ${ticketId}`)
  log(`Authorize URL: ${url}`)
  log()
  log(`After authorizing, run: netlify login --check ${ticketId}`)
  log()
  log('After user opens the authorization URL and approves, the login will be complete.')
}
