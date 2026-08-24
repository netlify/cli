import { NetlifyAPI } from '@netlify/api'
import { OptionValues } from 'commander'

import { log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { storeToken } from '../base-command.js'
import type { NetlifyOptions } from '../types.js'

export const loginCheck = async (
  options: OptionValues,
  apiOpts: NetlifyOptions['apiOpts'],
  globalConfig: NetlifyOptions['globalConfig'],
) => {
  const ticketId = options.check as string

  const api = new NetlifyAPI('', apiOpts)

  let ticket: { authorized?: boolean }
  try {
    ticket = await api.showTicket({ ticketId })
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401 || status === 404) {
      logJson({ status: 'denied' })
      log('Status: denied')
      return
    }
    throw error
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
