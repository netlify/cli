const promisify = require('util.promisify')
const ghauth = promisify(require('ghauth'))
const version = require('../../../package.json').version
const os = require('os')
const octokit = require('@octokit/rest')

const UA = 'Netlify CLI ' + version

module.exports = configGithub
async function configGithub(ctx, site, repo) {
  let ghtoken = ctx.global.get('ghauth')

  if (!ghtoken) {
    const newToken = await ghauth({
      noSave: true,
      scopes: ['repo'],
      userAgent: UA,
      note: `Netlify CLI ${os.userInfo().username}@${os.hostname()}`
    })
    ctx.global.set('ghauth', newToken)
    ghtoken = newToken
  }

  const kit = octokit()

  kit.authenticate({
    type: 'oauth',
    token: ghtoken.token
  })

  // const key = await ctx.netlify.createDeployKey()
}
