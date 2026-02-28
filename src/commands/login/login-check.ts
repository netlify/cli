import { NetlifyAPI } from '@netlify/api'
import { getGlobalConfigStore } from '@netlify/dev-utils'
import { OptionValues } from 'commander'

import { log, logAndThrowError, logJson, USER_AGENT } from '../../utils/command-helpers.js'
import { storeToken } from '../base-command.js'

export const loginCheck = async (options: OptionValues) => {
  const ticketId = options.check as string

  const api = new NetlifyAPI('', { userAgent: USER_AGENT })

  let ticket: { authorized?: boolean }
  try {
    ticket = await api.showTicket({ ticketId })
  } catch {
    logJson({ status: 'denied' })
    log('Status: denied')
    return
  }

  if (!ticket.authorized) {
    logJson({ status: 'pending' })
    log('Status: pending')
    return
  }

  const tokenResponse = await api.exchangeTicket({ ticketId })
  const accessToken = tokenResponse.access_token
  if (!accessToken) {
    return logAndThrowError('Could not retrieve access token')
  }

  api.accessToken = accessToken
  const user = await api.getCurrentUser()
  if (!user.id) {
    return logAndThrowError('Could not retrieve user ID from Netlify API')
  }

  const globalConfig = await getGlobalConfigStore()
  storeToken(globalConfig, {
    userId: user.id,
    name: user.full_name,
    email: user.email,
    accessToken,
  })

  logJson({
    status: 'authorized',
    user: { id: user.id, email: user.email, name: user.full_name },
  })

  log('Status: authorized')
  log(`Name: ${user.full_name ?? ''}`)
  log(`Email: ${user.email ?? ''}`)
}
