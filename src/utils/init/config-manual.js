const inquirer = require('inquirer')

module.exports = configManual
async function configManual(ctx, site, repo) {
  const key = await ctx.netlify.api.createDeployKey()

  ctx.log('\nGive this Netlify SSH public key access to your repository:\n')
  ctx.log(`\n${key.public_key}\n\n`)

  const { sshKeyAdded } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'sshKeyAdded',
      message: 'Continue?',
      default: true
    }
  ])

  if (!sshKeyAdded) {
    ctx.exit()
  }

  repo.provider = 'manual'
  repo.deploy_key_id = key.id

  // TODO: Look these up and default to the lookup order
  const { buildCmd, buildDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'buildCmd',
      message: 'Your build command (hugo build/yarn run build/etc):',
      filter: val => (val === '' ? undefined : val)
    },
    {
      type: 'input',
      name: 'buildDir',
      message: 'Directory to deploy (blank for current dir):',
      default: '.'
    }
  ])
  repo.dir = buildDir

  if (!repo.repo_path) {
    const { repoPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'repoPath',
        message: 'The SSH URL of the remote git repo:',
        default: repo.repo_path,
        validate: url =>
          !!url.match(/(ssh:\/\/|[a-zA-Z]*@|[a-zA-Z.].*:(?!\/\/))/) || 'The URL provided does not use the SSH protocol'
      }
    ])
    repo.repo_path = repoPath
  }

  if (buildCmd) {
    repo.cmd = buildCmd
  }

  site = await ctx.netlify.api.updateSite({ siteId: site.id, body: { repo } })

  ctx.log('\nConfigure the following webhook for your repository:\n')
  ctx.log(`\n${site.deploy_hook}\n\n`)

  const { deployHookAdded } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'deployHookAdded',
      message: 'Continue?',
      default: true
    }
  ])

  if (!deployHookAdded) {
    ctx.exit()
  }
}
