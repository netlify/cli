import { NetlifyAPI } from '@netlify/api'

import { log, logAndThrowError, logJson, USER_AGENT } from '../../utils/command-helpers.js'
import { CLIENT_ID } from '../base-command.js'

export const loginRequest = async () => {
  const webUI = process.env.NETLIFY_WEB_UI || 'https://app.netlify.com'

  const api = new NetlifyAPI('', { userAgent: USER_AGENT })

  const ticket = await api.createTicket({ clientId: CLIENT_ID })

  if (!ticket.id) {
    return logAndThrowError('Failed to create login ticket')
  }
  const ticketId = ticket.id
  const url = `${webUI}/authorize?response_type=ticket&ticket=${ticketId}`

  logJson({ ticket_id: ticketId, url, check_command: `netlify login --check ${ticketId}` })

  log(`Ticket ID: ${ticketId}`)
  log(`Authorize URL: ${url}`)
  log()
  log(`After authorizing, run: netlify login --check ${ticketId}`)
}
