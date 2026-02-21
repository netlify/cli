import path from 'path'
import process from 'process'

import type BaseCommand from '../../commands/base-command.js'
import { chalk, log, netlifyCommand } from '../command-helpers.js'
import execa from '../execa.js'

import { getBuildSettings, saveNetlifyToml, setupSite } from './utils.js'

export const configNetlifyGit = async ({ command, siteId }: { command: BaseCommand; siteId: string }) => {
  const {
    api,
    cachedConfig: { configPath },
    config,
    repositoryRoot,
  } = command.netlify

  // 1. Prompt for build settings
  const { baseDir, buildCmd, buildDir, functionsDir, pluginsToInstall } = await getBuildSettings({
    config,
    command,
  })

  // 2. Save netlify.toml
  await saveNetlifyToml({ repositoryRoot, config, configPath, baseDir, buildCmd, buildDir, functionsDir })

  // 3. Set up the site with netlify-git provider via API
  const repo = {
    provider: 'netlify-git',
    repo_branch: 'main',
    allowed_branches: ['main'],
    ...(baseDir && { base: baseDir }),
    ...(buildDir && { dir: buildDir }),
    ...(functionsDir && { functions_dir: functionsDir }),
    ...(buildCmd && { cmd: buildCmd }),
  }

  const updatedSite = await setupSite({
    api,
    siteId,
    repo,
    configPlugins: config.plugins ?? [],
    pluginsToInstall,
  })

  // 4. Read the remote URL from the API response
  const remoteUrl = updatedSite.build_settings?.repo_url
  if (!remoteUrl) {
    log(chalk.yellow('Warning: Could not determine git remote URL from API response.'))
    log('You may need to configure the git remote manually.')
    return
  }

  // 5. Initialize git if needed
  try {
    await execa('git', ['rev-parse', '--git-dir'])
  } catch {
    await execa('git', ['init', '.'])
  }

  // 6. Add netlify remote (remove existing if present)
  try {
    const { stdout: remotes } = await execa('git', ['remote'])
    if (remotes.includes('netlify')) {
      await execa('git', ['remote', 'set-url', 'netlify', remoteUrl])
    } else {
      await execa('git', ['remote', 'add', 'netlify', remoteUrl])
    }
  } catch {
    await execa('git', ['remote', 'add', 'netlify', remoteUrl])
  }

  // 7. Set local main branch to track netlify/main if no tracking branch is set
  const { stdout: trackingBranch } = await execa('git', ['config', '--get', 'branch.main.remote'], { reject: false })
  if (!trackingBranch.trim()) {
    await execa('git', ['config', '--local', 'branch.main.remote', 'netlify'])
    await execa('git', ['config', '--local', 'branch.main.merge', 'refs/heads/main'])
  }

  // 8. Configure credential helper so git uses `netlify git-credentials` for auth.
  // Git `!` credential helpers run in a non-interactive shell where bash aliases
  // aren't available. For direct invocations (global install, local dev, alias,
  // symlink), use the absolute node + script paths so it always resolves. For
  // package runner invocations (npx, pnpx, npm exec), process.argv[1] points
  // into a temp cache dir, so fall back to netlifyCommand() (e.g. "npx netlify").
  const origin = new URL(remoteUrl).origin
  const cliCommand = netlifyCommand()
  const credentialHelper =
    cliCommand === 'netlify' ? `'${process.execPath}' '${path.resolve(process.argv[1])}'` : cliCommand
  await execa('git', ['config', '--local', `credential.${origin}.helper`, `!${credentialHelper} git-credentials`])

  // 8. Log success
  log()
  log(chalk.greenBright.bold.underline('Success! Netlify Git configured!'))
  log()
  log(`Your project is set up to deploy via Netlify-hosted git.`)
  log(`Remote URL: ${chalk.cyan(remoteUrl)}`)
  log()
  log(`Next steps:`)
  log(`  ${chalk.cyanBright.bold(`${netlifyCommand()} push`)}        Push your code and trigger a deploy`)
  log(`  ${chalk.cyanBright.bold(`${netlifyCommand()} open`)}        Open the Netlify admin URL`)
  log()
}
