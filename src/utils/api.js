const NetlifysApiDefinition = require('netlifys_api_definition')

// See https://github.com/bcomnes/open-api/tree/with-docs/node
// TODO Fix the publishing workflow on the generated module
class Netlify {
  constructor(accessToken) {
    if (accessToken) {
      const defaultClient = NetlifysApiDefinition.ApiClient.instance
      const netlifyAuth = defaultClient.authentications['netlifyAuth']
      netlifyAuth.accessToken = accessToken
    }

    this.api = new NetlifysApiDefinition.DefaultApi()
  }
}

module.exports = Netlify
