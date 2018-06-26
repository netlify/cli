const NetlifysApiDefinition = require('netlifys_api_definition')

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
