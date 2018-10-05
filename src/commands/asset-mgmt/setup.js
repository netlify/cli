const Command = require('../../base')
const { flags } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const fs = require('fs')

const NETLIFY_GIT_LFS_SERVER_HOST = 'netlify-git-lfs.netlify.com'
const NETLIFY_GIT_LFS_SERVER_PATH = '/.netlify/functions/lfs'

class AssetMgmtSetupCommand extends Command {
  async run() {
    const { flags } = this.parse(AssetMgmtSetupCommand)
    const { api, site } = this.netlify
    const accessToken = this.getAuthToken()
    const exec = require('child_process').execFile

    if (!accessToken) {
      this.error(`Not logged in. Please run \`netlify login\` and try again`)
    }

    // check if git lfs is installed locally
    exec('git', ['lfs', '--version'], (error, stdout, stderr) => {
      if (error) {
        this.error('Git LFS is not installed. Please make sure to install it.', {exit: 1})
      }
    })

    if (!flags['skip-setup-repo']) {
      const siteId = site.get('siteId')
      let siteData

      if (!siteId) {
        this.warn(`No Site ID found in current directory.
  Run \`netlify link\` to connect to this folder to a site`)
        return false
      }

      try {
        siteData = await api.getSite({ siteId })
      } catch (e) {
        console.log('e', e)
        if (e.status === 401 /* unauthorized*/) {
          this.warn(`Log in with a different account or re-link to a site you have permission for`)
          this.error(`Not authorized to view the currently linked site (${siteId})`)
        }
        if (e.status === 404 /* site not found */) {
          this.log(`No site with id ${siteId} found.`)
          this.log('Please double check this ID and verify you are logged in with the correct account')
          this.log()
          this.log('To fix this, run `netlify unlink` then `netlify link` to reconnect to the correct site ID')
          this.log()
          this.error(`Site (${siteId}) not found in account`)
        }
        this.error(e)
      }

      // check if the command is run from the git repo root
      try {
        fs.lstatSync('.git')
      } catch (e) {
        this.error('Please run the command in the git repository.', {exit: 1})
      }

      if (!siteData.capabilities.asset_management) {
        this.warn(`This site has not configured with Asset Management yet.
  Please visit admin UI and enable it first:
  > ${siteData.admin_url}`)
        return false
      }

      this.log(`Setup Asset Management with site "${siteData.name}"`)

      // .lfsconfig setup
      this.log('Creating .lfsconfig file with the custom lfs url...')
      const lfsUrl = `https://${siteData.id}:@${NETLIFY_GIT_LFS_SERVER_HOST}${NETLIFY_GIT_LFS_SERVER_PATH}`
      exec('git', ['config', '-f', '.lfsconfig', 'lfs.url', lfsUrl], (error, stdout, stderr) => {
        if (error) {
          this.error('Failed to create .lfsconfig file.', {exit: 1})
        }
      })
    } else {
      this.log('Setup Asset Management without setting up the repo')
    }

    // global .gitconfig setup
    this.log('Setup global git config for the authentication with Netlify LFS server...')
    const extraHeader = `http.https://${NETLIFY_GIT_LFS_SERVER_HOST}${NETLIFY_GIT_LFS_SERVER_PATH}.extraheader`
    const header = `AuthToken: ${accessToken}`
    exec('git', ['config', '--global', extraHeader, header], (error, stdout, stderr) => {
      if (error) {
        this.error('Failed to setup global git config.', {exit: 1})
      }
    })

    this.log('Asset Management setup completed successfully.')
    if (!flags['skip-setup-repo']) {
      this.log('Please make sure to git add .lfsconfig file.')
      this.log('')
      this.log('Pro tips 💡:')
      this.log(' * Start tracking files using `git lfs track "*.jpg"`')
      this.log(' * Migrate existing files using `git lfs migrate --everything`')
      this.log('Do not forget!💡:')
      this.log(' * Make sure to git add .lfsconfig and .gitattributes!')
    }
    this.exit()
  }
}

AssetMgmtSetupCommand.description = `${renderShortDesc('Setup Netlify Asset Management with the repo')}`

AssetMgmtSetupCommand.examples = ['netlify asset-mgmt:setup --skip-setup-repo']

AssetMgmtSetupCommand.flags = {
  'skip-setup-repo': flags.boolean({
    description: 'Setup without setting up the repo'
  })
}

module.exports = AssetMgmtSetupCommand
