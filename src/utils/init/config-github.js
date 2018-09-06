const version = require('../../../package.json').version
const os = require('os')
const ghauth = require('../../utils/gh-auth')
const octokit = require('@octokit/rest')()
const parseGitRemote = require('parse-github-url')
const inquirer = require('inquirer')

const UA = 'Netlify CLI ' + version

module.exports = configGithub
async function configGithub(ctx, site, repo) {

  const current = ctx.global.get('userId')

  let ghtoken = ctx.global.get(`users.${current}.auth.github`)

  if (!ghtoken || !ghtoken.user || !ghtoken.token) {
    const newToken = await ghauth({
      scopes: ['admin:org', 'admin:public_key', 'repo', 'user'],
      userAgent: UA,
      note: `Netlify CLI ${os.userInfo().username}@${os.hostname()}`
    })
    console.log('newToken', newToken)
    ctx.global.set(`users.${current}.auth.github`, newToken)
    ghtoken = newToken
  }

  octokit.authenticate({
    type: 'oauth',
    token: ghtoken.token
  })

  const key = await ctx.netlify.createDeployKey()
  const parsedURL = parseGitRemote(repo.repo_path)
  await octokit.repos.addDeployKey({
    title: 'Netlify Deploy Key',
    key: key.public_key,
    repo: parsedURL.name,
    owner: parsedURL.owner,
    read_only: true
  })

  repo.deploy_key_id = key.id

  // TODO: Look these up and default to the lookup order

  // read netlify toml

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
  if (buildCmd) {
    repo.cmd = buildCmd
  }

  const results = await octokit.repos.get({
    owner: parsedURL.owner,
    repo: parsedURL.name
  })

  repo.id = results.data.id
  repo.repo_path = results.data.full_name
  repo.repo_branch = results.data.default_branch
  repo.allowed_branches = [results.data.default_branch]

  site = await ctx.netlify.updateSite({ siteId: site.id, body: { repo } })

  const hooks = await octokit.repos.getHooks({
    owner: parsedURL.owner,
    repo: parsedURL.name,
    per_page: 100
  })

  let hookExists = false

  hooks.data.forEach(hook => {
    if (hook.config.url === site.deploy_hook) hookExists = true
  })

  if (!hookExists) {
    try {
      await octokit.repos.createHook({
        owner: parsedURL.owner,
        repo: parsedURL.name,
        name: 'web',
        config: {
          url: site.deploy_hook,
          content_type: 'json'
        },
        events: ['push', 'pull_request', 'delete'],
        active: true
      })
    } catch (e) {
      // Ignore exists error if the list doesn't return all installed hooks
      if (!e.message.includes('Hook already exists on this repository')) ctx.error(e)
    }
  }

  // TODO: Generalize this so users can reset these automatically.
  // Quick and dirty implementation
  const ntlHooks = await ctx.netlify.listHooksBySiteId({ siteId: site.id })

  const createdHook = ntlHooks.find(h => h.type === 'github_commit_status' && h.event === 'deploy_created')
  const failedHook = ntlHooks.find(h => h.type === 'github_commit_status' && h.event === 'deploy_failed')
  const buildingHook = ntlHooks.find(h => h.type === 'github_commit_status' && h.event === 'deploy_building')
  ctx.log()
  ctx.log(`Creating Netlify Github Notification Hooks...`)


  if (!createdHook || createdHook.disabled) {
    await ctx.netlify.createHookBySiteId({
      site_id: site.id,
      body: {
        type: 'github_commit_status',
        event: 'deploy_created',
        data: {
          access_token: ghtoken.token
        }
      }
    })
    // ctx.log(`Created Github deploy_created Hook: ${h.id}`)
  } else {
    await ctx.netlify.updateHook({
      hook_id: createdHook.id,
      body: {
        data: {
          access_token: ghtoken.token
        }
      }
    })
    // ctx.log(`Updated Github Created Hook: ${h.id}`)
  }

  if (!failedHook || failedHook.disabled) {
    await ctx.netlify.createHookBySiteId({
      site_id: site.id,
      body: {
        type: 'github_commit_status',
        event: 'deploy_failed',
        data: {
          access_token: ghtoken.token
        }
      }
    })
    // ctx.log(`Created Github deploy_failed hook: ${h.id}`)
  } else {
    await ctx.netlify.updateHook({
      hook_id: failedHook.id,
      body: {
        data: {
          access_token: ghtoken.token
        }
      }
    })
    // ctx.log(`Updated Github deploy_failed hook: ${h.id}`)
  }

  if (!buildingHook || buildingHook.disabled) {
    await ctx.netlify.createHookBySiteId({
      site_id: site.id,
      body: {
        type: 'github_commit_status',
        event: 'deploy_building',
        data: {
          access_token: ghtoken.token
        }
      }
    })
    // ctx.log(`Created Github deploy_building hook: ${h.id}`)
  } else {
    await ctx.netlify.updateHook({
      hook_id: buildingHook.id,
      body: {
        data: {
          access_token: ghtoken.token
        }
      }
    })
    // ctx.log(`Updated Github deploy_building hook: ${h.id}`)
  }

  ctx.log(`Netlify Notification Hooks configured!`)
}
