const inquirer = require('inquirer')
const { makeNetlifyTOMLtemplate } = require('./netlify-toml-template')

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
      default: true,
    },
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
      filter: val => (val === '' ? undefined : val),
    },
    {
      type: 'input',
      name: 'buildDir',
      message: 'Directory to deploy (blank for current dir):',
      default: '.',
    },
  ])

  const fs = require('fs')
  const path = require('path')
  const tomlpath = path.join(ctx.netlify.site.root, 'netlify.toml')
  const tomlDoesNotExist = !fs.existsSync(tomlpath)
  if (tomlDoesNotExist && (!ctx.netlify.config || Object.keys(ctx.netlify.config).length === 0)) {
    const { makeNetlifyTOML } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'makeNetlifyTOML',
        message: 'No netlify.toml detected. Would you like to create one with these build settings?',
        default: true,
      },
    ])
    if (makeNetlifyTOML && ctx.netlify.site && ctx.netlify.site.root) {
      fs.writeFileSync(tomlpath, makeNetlifyTOMLtemplate({ command: buildCmd, publish: buildDir }))
    } else {
      throw new Error('NetlifyCLIError: expected there to be a Netlify site root, please investigate', ctx.netlify.site)
    }
  }

  repo.dir = buildDir

  if (!repo.repo_path) {
    const { repoPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'repoPath',
        message: 'The SSH URL of the remote git repo:',
        default: repo.repo_path,
        validate: url =>
          !!url.match(/(ssh:\/\/|[a-zA-Z]*@|[a-zA-Z.].*:(?!\/\/))/) || 'The URL provided does not use the SSH protocol',
      },
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
      default: true,
    },
  ])

  if (!deployHookAdded) {
    ctx.exit()
  }
}
