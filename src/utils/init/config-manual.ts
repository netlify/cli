// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'inquirer'.
const inquirer = require('inquirer')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'log'.
const { exit, log } = require('../command-helpers.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'createDepl... Remove this comment to see the full error message
const { createDeployKey, getBuildSettings, saveNetlifyToml, setupSite } = require('./utils.cjs')

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'addDeployK... Remove this comment to see the full error message
const addDeployKey = async ({
  deployKey
}: $TSFixMe) => {
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

const getRepoPath = async ({
  repoData
}: $TSFixMe) => {
  const { repoPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoPath',
      message: 'The SSH URL of the remote git repo:',
      default: repoData.url,
      validate: (url: $TSFixMe) => SSH_URL_REGEXP.test(url) || 'The URL provided does not use the SSH protocol',
    },
  ])

  return repoPath
}

// @ts-expect-error TS(2451) FIXME: Cannot redeclare block-scoped variable 'addDeployH... Remove this comment to see the full error message
const addDeployHook = async ({
  deployHook
}: $TSFixMe) => {
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

/**
 * @param {object} config
 * @param {import('../../commands/base-command').BaseCommand} config.command
 * @param {*} config.repoData
 * @param {string} config.siteId
 */
module.exports = async function configManual({
  command,
  repoData,
  siteId
}: $TSFixMe) {
  const { netlify } = command
  const {
    api,
    cachedConfig: { configPath, env },
    config,
    repositoryRoot,
    site: { root: siteRoot },
  } = netlify

  const { baseDir, buildCmd, buildDir, functionsDir, pluginsToInstall } = await getBuildSettings({
    repositoryRoot,
    siteRoot,
    config,
    env,
  })
  await saveNetlifyToml({ repositoryRoot, config, configPath, baseDir, buildCmd, buildDir, functionsDir })

  const deployKey = await createDeployKey({ api })
  await addDeployKey({ deployKey })

  const repoPath = await getRepoPath({ repoData })
  const repo = {
    provider: 'manual',
    repo_path: repoPath,
    repo_branch: repoData.branch,
    allowed_branches: [repoData.branch],
    deploy_key_id: deployKey.id,
    base: baseDir,
    dir: buildDir,
    functions_dir: functionsDir,
    ...(buildCmd && { cmd: buildCmd }),
  }

  const updatedSite = await setupSite({
    api,
    siteId,
    repo,
    configPlugins: config.plugins,
    pluginsToInstall,
  })
  const deployHookAdded = await addDeployHook({ deployHook: updatedSite.deploy_hook })
  // @ts-expect-error TS(1345) FIXME: An expression of type 'void' cannot be tested for ... Remove this comment to see the full error message
  if (!deployHookAdded) {
    exit()
  }
}

const SSH_URL_REGEXP = /(ssh:\/\/|[a-zA-Z]*@|[a-zA-Z.].*:(?!\/\/))/
