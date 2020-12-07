const { Octokit } = require('@octokit/rest')
const chalk = require('chalk')

const ghauth = require('../gh-auth')

const { getBuildSettings, saveNetlifyToml, formatErrorMessage, createDeployKey, updateSite } = require('./utils')

const formatRepoAndOwner = ({ repoOwner, repoName }) => ({
  name: chalk.magenta(repoName),
  owner: chalk.magenta(repoOwner),
})

const PAGE_SIZE = 100

const isValidToken = (token) => token && token.user && token.token

const getGitHubToken = async ({ log, globalConfig }) => {
  const userId = globalConfig.get('userId')
  const githubToken = globalConfig.get(`users.${userId}.auth.github`)

  if (isValidToken(githubToken)) {
    return githubToken.token
  }

  const newToken = await ghauth({
    log,
  })
  globalConfig.set(`users.${userId}.auth.github`, newToken)
  return newToken.token
}

const getGitHubClient = ({ token }) => {
  const octokit = new Octokit({
    auth: `token ${token}`,
  })
  return octokit
}

const addDeployKey = async ({ log, api, octokit, repoOwner, repoName, failAndExit }) => {
  log('Adding deploy key to repository...')
  const key = await createDeployKey({ api, failAndExit })
  try {
    await octokit.repos.addDeployKey({
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

const getGitHubRepo = async ({ octokit, repoOwner, repoName, failAndExit }) => {
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

const hookExists = async ({ deployHook, octokit, repoOwner, repoName }) => {
  try {
    const { data: hooks } = await octokit.repos.listHooks({
      owner: repoOwner,
      repo: repoName,
      per_page: PAGE_SIZE,
    })
    const exists = hooks.some((hook) => hook.config.url === deployHook)
    return exists
  } catch (_) {
    // we don't need to fail if listHooks errors out
    return false
  }
}

const addDeployHook = async ({ deployHook, octokit, repoOwner, repoName, failAndExit }) => {
  const exists = await hookExists({ deployHook, octokit, repoOwner, repoName })
  if (!exists) {
    try {
      await octokit.repos.createHook({
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

const upsertHook = async ({ ntlHooks, event, api, siteId, token }) => {
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

const addNotificationHooks = async ({ log, failAndExit, siteId, api, token }) => {
  log(`Creating Netlify Github Notification Hooks...`)

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

module.exports = async function configGithub({ context, siteId, repoOwner, repoName }) {
  const { log, warn, error: failAndExit, netlify } = context
  const {
    api,
    globalConfig,
    config,
    site: { root: siteRoot },
  } = netlify

  const token = await getGitHubToken({ log, globalConfig })

  const { buildCmd, buildDir, functionsDir } = await getBuildSettings({ siteRoot, config })
  await saveNetlifyToml({ siteRoot, config, buildCmd, buildDir, functionsDir, warn })

  const octokit = getGitHubClient({ token })
  const [deployKey, githubRepo] = await Promise.all([
    addDeployKey({ log, api, octokit, repoOwner, repoName, failAndExit }),
    getGitHubRepo({ octokit, repoOwner, repoName, failAndExit }),
  ])

  const repo = {
    id: githubRepo.id,
    provider: 'github',
    repo_path: githubRepo.full_name,
    repo_branch: githubRepo.default_branch,
    allowed_branches: [githubRepo.default_branch],
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
  await addDeployHook({ deployHook: updatedSite.deploy_hook, octokit, repoOwner, repoName, failAndExit })
  log()
  await addNotificationHooks({ log, failAndExit, siteId, api, token })
}
