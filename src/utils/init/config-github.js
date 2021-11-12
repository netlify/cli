const { Octokit } = require('@octokit/rest')
const chalk = require('chalk')

const { error: failAndExit, log } = require('../command-helpers')
const { getGitHubToken: ghauth } = require('../gh-auth')

const { createDeployKey, formatErrorMessage, getBuildSettings, saveNetlifyToml, setupSite } = require('./utils')

const formatRepoAndOwner = ({ repoName, repoOwner }) => ({
  name: chalk.magenta(repoName),
  owner: chalk.magenta(repoOwner),
})

const PAGE_SIZE = 100

const isValidToken = (token) => token && token.user && token.token

const getGitHubToken = async ({ globalConfig }) => {
  const userId = globalConfig.get('userId')
  const githubToken = globalConfig.get(`users.${userId}.auth.github`)

  if (isValidToken(githubToken)) {
    return githubToken.token
  }

  const newToken = await ghauth()
  globalConfig.set(`users.${userId}.auth.github`, newToken)
  return newToken.token
}

const getGitHubClient = ({ token }) => {
  const octokit = new Octokit({
    auth: `token ${token}`,
  })
  return octokit
}

const addDeployKey = async ({ api, octokit, repoName, repoOwner }) => {
  log('Adding deploy key to repository...')
  const key = await createDeployKey({ api })
  try {
    await octokit.repos.createDeployKey({
      title: 'Netlify Deploy Key',
      key: key.public_key,
      owner: repoOwner,
      repo: repoName,
      read_only: true,
    })
    log('Deploy key added!')
    return key
  } catch (error) {
    let message = formatErrorMessage({ message: 'Failed adding GitHub deploy key', error })
    if (error.status === 404) {
      const { name, owner } = formatRepoAndOwner({ repoName, repoOwner })
      message = `${message}. Does the repository ${name} exist and do ${owner} has the correct permissions to set up deploy keys?`
    }
    failAndExit(message)
  }
}

const getGitHubRepo = async ({ octokit, repoName, repoOwner }) => {
  try {
    const { data } = await octokit.repos.get({
      owner: repoOwner,
      repo: repoName,
    })
    return data
  } catch (error) {
    let message = formatErrorMessage({ message: 'Failed retrieving GitHub repository information', error })
    if (error.status === 404) {
      const { name, owner } = formatRepoAndOwner({ repoName, repoOwner })
      message = `${message}. Does the repository ${name} exist and accessible by ${owner}`
    }
    failAndExit(message)
  }
}

const hookExists = async ({ deployHook, octokit, repoName, repoOwner }) => {
  try {
    const { data: hooks } = await octokit.repos.listWebhooks({
      owner: repoOwner,
      repo: repoName,
      per_page: PAGE_SIZE,
    })
    const exists = hooks.some((hook) => hook.config.url === deployHook)
    return exists
  } catch {
    // we don't need to fail if listHooks errors out
    return false
  }
}

const addDeployHook = async ({ deployHook, octokit, repoName, repoOwner }) => {
  const exists = await hookExists({ deployHook, octokit, repoOwner, repoName })
  if (!exists) {
    try {
      await octokit.repos.createWebhook({
        owner: repoOwner,
        repo: repoName,
        name: 'web',
        config: {
          url: deployHook,
          content_type: 'json',
        },
        events: ['push', 'pull_request', 'delete'],
        active: true,
      })
    } catch (error) {
      // Ignore exists error if the list doesn't return all installed hooks
      if (!error.message.includes('Hook already exists on this repository')) {
        let message = formatErrorMessage({ message: 'Failed creating repo hook', error })
        if (error.status === 404) {
          const { name, owner } = formatRepoAndOwner({ repoName, repoOwner })
          message = `${message}. Does the repository ${name} and do ${owner} has the correct permissions to set up hooks`
        }
        failAndExit(message)
      }
    }
  }
}

const GITHUB_HOOK_EVENTS = ['deploy_created', 'deploy_failed', 'deploy_building']
const GITHUB_HOOK_TYPE = 'github_commit_status'

const upsertHook = async ({ api, event, ntlHooks, siteId, token }) => {
  const ntlHook = ntlHooks.find((hook) => hook.type === GITHUB_HOOK_TYPE && hook.event === event)

  if (!ntlHook || ntlHook.disabled) {
    return await api.createHookBySiteId({
      site_id: siteId,
      body: {
        type: GITHUB_HOOK_TYPE,
        event,
        data: {
          access_token: token,
        },
      },
    })
  }

  return await api.updateHook({
    hook_id: ntlHook.id,
    body: {
      data: {
        access_token: token,
      },
    },
  })
}

const addNotificationHooks = async ({ api, siteId, token }) => {
  log(`Creating Netlify GitHub Notification Hooks...`)

  let ntlHooks
  try {
    ntlHooks = await api.listHooksBySiteId({ siteId })
  } catch (error) {
    const message = formatErrorMessage({ message: 'Failed retrieving Netlify hooks', error })
    failAndExit(message)
  }
  await Promise.all(
    GITHUB_HOOK_EVENTS.map(async (event) => {
      try {
        await upsertHook({ ntlHooks, event, api, siteId, token })
      } catch (error) {
        const message = formatErrorMessage({ message: `Failed settings Netlify hook ${chalk.magenta(event)}`, error })
        failAndExit(message)
      }
    }),
  )

  log(`Netlify Notification Hooks configured!`)
}

module.exports = async function configGithub({ context, repoName, repoOwner, siteId }) {
  const { netlify } = context
  const {
    api,
    cachedConfig: { configPath, env },
    config,
    globalConfig,
    repositoryRoot,
    site: { root: siteRoot },
  } = netlify

  const token = await getGitHubToken({ globalConfig })

  const { baseDir, buildCmd, buildDir, functionsDir, pluginsToInstall } = await getBuildSettings({
    repositoryRoot,
    siteRoot,
    config,
    env,
  })
  await saveNetlifyToml({ repositoryRoot, config, configPath, baseDir, buildCmd, buildDir, functionsDir })

  const octokit = getGitHubClient({ token })
  const [deployKey, githubRepo] = await Promise.all([
    addDeployKey({ api, octokit, repoOwner, repoName }),
    getGitHubRepo({ octokit, repoOwner, repoName }),
  ])

  const repo = {
    id: githubRepo.id,
    provider: 'github',
    repo_path: githubRepo.full_name,
    repo_branch: githubRepo.default_branch,
    allowed_branches: [githubRepo.default_branch],
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
  await addDeployHook({ deployHook: updatedSite.deploy_hook, octokit, repoOwner, repoName })
  log()
  await addNotificationHooks({ siteId, api, token })
}
