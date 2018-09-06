const Command = require('../../base')
const renderShortDesc = require('../../utils/renderShortDescription')
const ghauth = require('../../utils/gh-auth')
const version = require('../../../package.json').version
const os = require('os')

const UA = 'Netlify CLI ' + version

class LoginGithubCommand extends Command {
  async run() {
    // const { flags, args } = this.parse(LoginCommand)

    if (this.global.get('ghauth')) {
      this.error(`Already logged in as ${this.global.get('ghauth.user')}`)
    }

    try {
      const newToken = await ghauth({
        scopes: ['admin:org', 'admin:public_key', 'repo', 'user'],
        userAgent: UA,
        note: `Netlify CLI ${os.userInfo().username}@${os.hostname()}`
      })
      this.global.set('ghauth', newToken)
    } catch (e) {
      this.error(e.message)
    }

    return this.exit()
  }
}

LoginGithubCommand.description = `${renderShortDesc('Login to your Netlify account')}

Opens a web browser to acquire an OAuth token.`

module.exports = LoginGithubCommand
