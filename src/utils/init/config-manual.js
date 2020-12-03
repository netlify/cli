const inquirer = require('inquirer')

const { getBuildSettings, saveNetlifyToml, createDeployKey, updateSite } = require('./utils')

const addDeployKey = async ({ log, exit, deployKey }) => {
  log('\nGive this Netlify SSH public key access to your repository:\n')
  log(`\n${deployKey.public_key}\n\n`)

  const { sshKeyAdded } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'sshKeyAdded',
      message: 'Continue?',
      default: true,
    },
  ])

  if (!sshKeyAdded) {
    exit()
  }
}

const getRepoPath = async ({ repoData }) => {
  const { repoPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoPath',
      message: 'The SSH URL of the remote git repo:',
      default: repoData.url,
      validate: (url) => SSH_URL_REGEXP.test(url) || 'The URL provided does not use the SSH protocol',
    },
  ])

  return repoPath
}

const addDeployHook = async ({ log, deployHook }) => {
  log('\nConfigure the following webhook for your repository:\n')
  log(`\n${deployHook}\n\n`)
  const { deployHookAdded } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'deployHookAdded',
      message: 'Continue?',
      default: true,
    },
  ])

  return deployHookAdded
}

module.exports = async function configManual({ context, siteId, repoData }) {
  const { log, warn, error: failAndExit, exit, netlify } = context
  const {
    api,
    config,
    site: { root: siteRoot },
  } = netlify

  const { buildCmd, buildDir, functionsDir } = await getBuildSettings({ siteRoot, config })
  await saveNetlifyToml({ siteRoot, config, buildCmd, buildDir, functionsDir, warn })

  const deployKey = await createDeployKey({ api, failAndExit })
  await addDeployKey({ log, exit, deployKey })

  const repoPath = await getRepoPath({ repoData })
  const repo = {
    provider: 'manual',
    repo_path: repoPath,
    repo_branch: repoData.branch,
    allowed_branches: [repoData.branch],
    deploy_key_id: deployKey.id,
    dir: buildDir,
    ...(buildCmd && { cmd: buildCmd }),
  }

  await updateSite({ siteId, api, failAndExit, options: { repo } })
  // calling updateSite with { repo } resets the functions dir so we need to sync it
  const updatedSite = await updateSite({
    siteId,
    api,
    failAndExit,
    options: { build_settings: { functions_dir: functionsDir } },
  })
  const deployHookAdded = await addDeployHook({ log, deployHook: updatedSite.deploy_hook })
  if (!deployHookAdded) {
    exit()
  }
}

const SSH_URL_REGEXP = /(ssh:\/\/|[a-zA-Z]*@|[a-zA-Z.].*:(?!\/\/))/
