const version = require('../../../package.json').version
const os = require('os')
const ghauth = require('../../utils/gh-auth')
const Octokit = require('@octokit/rest')
const parseGitRemote = require('parse-github-url')
const inquirer = require('inquirer')
const path = require('path')
const fs = require('fs')
const chalk = require('chalk')
const { makeNetlifyTOMLtemplate } = require('./netlify-toml-template')

const UA = 'Netlify CLI ' + version

module.exports = configGithub
async function configGithub(ctx, site, repo) {
  const { api, globalConfig } = ctx.netlify
  const current = globalConfig.get('userId')

  let ghtoken = globalConfig.get(`users.${current}.auth.github`)

  if (!ghtoken || !ghtoken.user || !ghtoken.token) {
    const newToken = await ghauth({
      scopes: ['admin:org', 'admin:public_key', 'repo', 'user'],
      userAgent: UA,
      note: `Netlify CLI ${os.userInfo().username}@${os.hostname()}`
    })
    globalConfig.set(`users.${current}.auth.github`, newToken)
    ghtoken = newToken
  }
  const octokit = new Octokit({
    auth: `token ${ghtoken.token}`
  })

  const key = await api.createDeployKey()
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

  let defaultBuildCmd,
    defaultBuildDir = '.'
  const { build } = ctx.netlify.config // read from netlify toml
  if (build && build.command) {
    defaultBuildCmd = build.command
  }
  if (build && build.publish) {
    defaultBuildDir = build.publish
  }
  if (build && build.functions) console.log('Netlify functions folder is ' + chalk.yellow(build.functions))
  const { buildCmd, buildDir } = await inquirer.prompt([
    {
      type: 'input',
      name: 'buildCmd',
      message: 'Your build command (hugo build/yarn run build/etc):',
      filter: val => (val === '' ? '# no build command' : val),
      default: defaultBuildCmd
    },
    {
      type: 'input',
      name: 'buildDir',
      message: 'Directory to deploy (blank for current dir):',
      default: defaultBuildDir
    }
  ])

  const tomlpath = path.join(ctx.netlify.site.root, 'netlify.toml')
  const tomlDoesNotExist = !fs.existsSync(tomlpath)
  if (tomlDoesNotExist && (!ctx.netlify.config || Object.keys(ctx.netlify.config).length === 0)) {
    const { makeNetlifyTOML } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'makeNetlifyTOML',
        message: 'No netlify.toml detected. Would you like to create one with these build settings?',
        default: true
      }
    ])
    if (makeNetlifyTOML && ctx.netlify.site && ctx.netlify.site.root) {
      fs.writeFileSync(tomlpath, makeNetlifyTOMLtemplate({ command: buildCmd, publish: buildDir }))
    } else {
      throw new Error('NetlifyCLIError: expected there to be a Netlify site root, please investigate', ctx.netlify.site)
    }
  }

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

  site = await api.updateSite({ siteId: site.id, body: { repo } })

  const hooks = await octokit.repos.listHooks({
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
  const ntlHooks = await api.listHooksBySiteId({ siteId: site.id })

  const createdHook = ntlHooks.find(h => h.type === 'github_commit_status' && h.event === 'deploy_created')
  const failedHook = ntlHooks.find(h => h.type === 'github_commit_status' && h.event === 'deploy_failed')
  const buildingHook = ntlHooks.find(h => h.type === 'github_commit_status' && h.event === 'deploy_building')

  ctx.log()
  ctx.log(`Creating Netlify Github Notification Hooks...`)

  if (!createdHook || createdHook.disabled) {
    await api.createHookBySiteId({
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
    await api.updateHook({
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
    await api.createHookBySiteId({
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
    await api.updateHook({
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
    await api.createHookBySiteId({
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
    await api.updateHook({
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
