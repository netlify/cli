import { NetlifyAPI } from '@netlify/api'

import { log, logAndThrowError, logJson } from '../../utils/command-helpers.js'
import { isAPIError } from '../../utils/errors.js'
import { storeToken } from '../base-command.js'
import type { NetlifyOptions } from '../types.js'
import type { LoginOptionValues } from './option_values.js'

export const loginCheck = async (
  options: LoginOptionValues,
  apiOpts: NetlifyOptions['apiOpts'],
  globalConfig: NetlifyOptions['globalConfig'],
) => {
  // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style -- FIXME: only called once `login` has checked that `--check` is set
  const ticketId = options.check as string

  const api = new NetlifyAPI('', apiOpts)

  let ticket: { authorized?: boolean }
  try {
    ticket = await api.showTicket({ ticketId })
  } catch (error) {
    if (isAPIError(error) && (error.status === 401 || error.status === 404)) {
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
