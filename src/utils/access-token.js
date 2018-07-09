const pWaitFor = require('p-wait-for')
const pTimeout = require('p-timeout')

module.exports = async function getAccessToken(ticket) {
  const { id } = ticket
  let authorizedTicket
  await pTimeout(
    pWaitFor(async () => {
      const t = await this.api.showTicket(id)
      if (t.authorized) authorizedTicket = t
      return !!t.authorized
    }, 1000), // poll every 1 second
    3.6e6, // timeout after 1 hour
    'Timeout while waiting for ticket grant'
  )

  const accessToken = await api.exchangeTicket(authorizedTicket.id)
  return accessToken.access_token
}
