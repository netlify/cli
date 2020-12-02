const { Octokit } = require('@octokit/rest')

const ghauth = require('../gh-auth')

const { getBuildSettings, saveNetlifyToml } = require('./utils')

const PAGE_SIZE = 100

const isValidToken = (token) => {
  return token && token.user && token.token
}

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

const createDeployKey = async ({ api, octokit, repoOwner, repoName }) => {
  const key = await api.createDeployKey()
  await octokit.repos.addDeployKey({
    title: 'Netlify Deploy Key',
    key: key.public_key,
    owner: repoOwner,
    repo: repoName,
    read_only: true,
  })
  return key
}

const getGitHubRepo = async ({ octokit, repoOwner, repoName }) => {
  const { data: githubRepo } = await octokit.repos.get({
    owner: repoOwner,
    repo: repoName,
  })
  return githubRepo
}

const addDeployHook = async ({ deployHook, octokit, repoOwner, repoName, failAndExit }) => {
  const { data: hooks } = await octokit.repos.listHooks({
    owner: repoOwner,
    repo: repoName,
    per_page: PAGE_SIZE,
  })

  const hookExists = hooks.some((hook) => hook.config.url === deployHook)
  if (!hookExists) {
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
        failAndExit(error)
      }
    }
  }
}

module.exports = async function configGithub({ context, siteId, repoOwner, repoName }) {
  const { log, error: failAndExit, netlify } = context
  const {
    api,
    globalConfig,
    config,
    site: { root: siteRoot },
  } = netlify

  const token = await getGitHubToken({ log, globalConfig })

  const { buildCmd, buildDir, functionsDir } = await getBuildSettings({ siteRoot, config })
  await saveNetlifyToml({ siteRoot, config, buildCmd, buildDir, functionsDir })

  const octokit = getGitHubClient({ token })
  const [deployKey, githubRepo] = await Promise.all([
    createDeployKey({ api, octokit, repoOwner, repoName }),
    getGitHubRepo({ octokit, repoOwner, repoName }),
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

  const updatedSite = await api.updateSite({ siteId, body: { repo } })

  await addDeployHook({ deployHook: updatedSite.deploy_hook, octokit, repoOwner, repoName, failAndExit })

  log()
  log(`Creating Netlify Github Notification Hooks...`)

  // TODO: Generalize this so users can reset these automatically.
  // Quick and dirty implementation
  const ntlHooks = await api.listHooksBySiteId({ siteId })
  await Promise.all(GITHUB_HOOK_EVENTS.map((event) => upsertHook({ ntlHooks, event, api, siteId, token })))

  log(`Netlify Notification Hooks configured!`)
}

const upsertHook = function ({ ntlHooks, event, api, siteId, token }) {
  const ntlHook = ntlHooks.find((hook) => hook.type === GITHUB_HOOK_TYPE && hook.event === event)

  if (!ntlHook || ntlHook.disabled) {
    return api.createHookBySiteId({
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

  return api.updateHook({
    hook_id: ntlHook.id,
    body: {
      data: {
        access_token: token,
      },
    },
  })
}

const GITHUB_HOOK_EVENTS = ['deploy_created', 'deploy_failed', 'deploy_building']
const GITHUB_HOOK_TYPE = 'github_commit_status'
