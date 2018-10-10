const Command = require('../../base')
const { flags } = require('@oclif/command')
const renderShortDesc = require('../../utils/renderShortDescription')
const fs = require('fs')
const util = require('util')
const exec = util.promisify(require('child_process').execFile)
const inquirer = require('inquirer')
const chalk = require('chalk')

const NETLIFY_GIT_LFS_SERVER_HOST = 'netlify-git-lfs.netlify.com'
const NETLIFY_GIT_LFS_SERVER_PATH = '/.netlify/functions/lfs'

class LfsSetupCommand extends Command {
  async run() {
    const { flags } = this.parse(LfsSetupCommand)
    const { api, site } = this.netlify
    const accessToken = this.getAuthToken()

    if (!accessToken) {
      this.error(`Not logged in. Please run \`netlify login\` and try again`)
    }

    // check if git lfs is installed locally
    let major, minor
    try {
      const { stdout } = await exec('git', ['lfs', '--version'])
      let version = stdout.trim().split(' ')[0].split('/')[1]
      major = parseInt(version.split('.')[0])
      minor = parseInt(version.split('.')[1])
    } catch (err) {
      this.error('Git LFS must be installed to use Netlify LFS. https://git-lfs.github.com/', {exit: 1})
    }

    if (major < 2 || minor < 5) {
      this.error('Git LFS version must be 2.5.0 or above.', {exit: 1})
    }

    // for non skip-setup-repo case, connect git repo and netlify site
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
      try {
        await exec('git', ['config', '-f', '.lfsconfig', 'lfs.url', lfsUrl])
        await exec('git', ['add', '.lfsconfig'])
      } catch (err) {
        this.error('Failed to create .lfsconfig file.', {exit: 1})
      }

      // initial gitattribute setup
      this.log()
      this.log('Setup files to track with Git LFS...')
      const { stdout } = await exec('git', ['lfs', 'track'])
      if (stdout) {
        this.log('The following patterns are tracked currently.')
        this.log(stdout)
      }
      this.log(`${chalk.bold('Hint💡:')}`)
      this.log(' * track all jpg files with: *.jpg')
      this.log(' * track all files under assets folder with: assets/')
      this.log(' * track multi conditions: *.jpg *.png *.gif')
      const { gitLfsTrackFiles } = await inquirer.prompt([
        {
          type: 'input',
          name: 'gitLfsTrackFiles',
          message: 'Specify which files you want to track (optional):',
          filter: val => (val === '' ? undefined : val)
        }
      ])

      if (gitLfsTrackFiles) {
        try {
          let trackFiles = gitLfsTrackFiles.split(' ')
          await exec('git', ['lfs', 'track'].concat(trackFiles))
          await exec('git', ['add', '.gitattributes'])
        } catch (err) {
          this.warn('Failed to trac files with given args. Skip this step.')
        }
      } else {
        this.log('Skip tracking files.')
      }
    } else {
      this.log('Setup Asset Management without setting up the repo')
    }

    // global .gitconfig setup
    this.log()
    this.log('Setup global git config for the authentication with Netlify LFS server...')
    const extraHeader = `http.https://${NETLIFY_GIT_LFS_SERVER_HOST}${NETLIFY_GIT_LFS_SERVER_PATH}.extraheader`
    const header = `AuthToken: ${accessToken}`
    exec('git', ['config', '--global', extraHeader, header], (error, stdout, stderr) => {
      if (error) {
        this.error('Failed to setup global git config.', {exit: 1})
      }
    })

    this.log(`${chalk.bold('Asset Management/LFS setup completed successfully')}`)
    if (!flags['skip-setup-repo']) {
      this.log(`${chalk.bold('Tips💡:')}`)
      this.log(' * Tweak the tracking setting using `git lfs track`')
      this.log(' * Migrate existing files using `git lfs migrate --everything`')
      this.log(' * Check current staged files using `git lfs status`')
    }
    this.exit()
  }
}

LfsSetupCommand.description = `${renderShortDesc('Setup Netlify Asset Management/LFS with the repo')}`

LfsSetupCommand.examples = ['netlify lfs:setup --skip-setup-repo']

LfsSetupCommand.flags = {
  'skip-setup-repo': flags.boolean({
    description: 'Setup without setting up the repo'
  })
}

module.exports = LfsSetupCommand
