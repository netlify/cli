const pWaitFor = require('p-wait-for')
const pTimeout = require('p-timeout')

module.exports = async function getAccessToken(api, ticket, opts) {
  opts = Object.assign(
    {
      poll: 1000,
      timeout: 3.6e6
    },
    opts
  )

  const { id } = ticket
  let authorizedTicket
  await pTimeout(
    pWaitFor(async () => {
      const t = await api.showTicket(id)
      if (t.authorized) authorizedTicket = t
      return !!t.authorized
    }, opts.poll),
    opts.timeout,
    'Timeout while waiting for ticket grant'
  )

  const accessToken = await api.exchangeTicket(authorizedTicket.id)
  return accessToken.access_token
}
