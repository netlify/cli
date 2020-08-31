const path = require('path')
const { flags } = require('@oclif/command')
const child_process = require('child_process')
const waitPort = require('wait-port')
const stripAnsiCc = require('strip-ansi-control-characters')
const which = require('which')
const { serverSettings } = require('../../utils/detect-server')
const { startFunctionsServer } = require('../../utils/serve-functions')
const Command = require('../../utils/command')
const chalk = require('chalk')
const open = require('open')
const { NETLIFYDEV, NETLIFYDEVLOG, NETLIFYDEVWARN, NETLIFYDEVERR } = require('../../utils/logo')
const boxen = require('boxen')
const { startLiveTunnel } = require('../../utils/live-tunnel')
const { getEnvSettings } = require('../../utils/env')
const { startProxy } = require('../../utils/proxy')

async function startFrameworkServer({ settings, log, exit }) {
  if (settings.noCmd) {
    const StaticServer = require('static-server')

    const server = new StaticServer({
      rootPath: settings.dist,
      name: 'netlify-dev',
      port: settings.frameworkPort,
      templates: {
        notFound: path.join(settings.dist, '404.html'),
      },
    })

    await new Promise(resolve => {
      server.start(function() {
        log(`\n${NETLIFYDEVLOG} Server listening to`, settings.frameworkPort)
        resolve()
      })
    })
    return
  }

  log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.framework || 'custom config'}`)
  const commandBin = await which(settings.command).catch(err => {
    if (err.code === 'ENOENT') {
      throw new Error(
        `"${settings.command}" could not be found in your PATH. Please make sure that "${settings.command}" is installed and available in your PATH`
      )
    }
    throw err
  })
  const ps = child_process.spawn(commandBin, settings.args, {
    env: { ...process.env, ...settings.env, FORCE_COLOR: 'true' },
    stdio: 'pipe',
  })

  ps.stdout.pipe(stripAnsiCc.stream()).pipe(process.stdout)
  ps.stderr.pipe(stripAnsiCc.stream()).pipe(process.stderr)

  process.stdin.pipe(process.stdin)

  function handleProcessExit(code) {
    log(
      code > 0 ? NETLIFYDEVERR : NETLIFYDEVWARN,
      `"${[settings.command, ...settings.args].join(' ')}" exited with code ${code}. Shutting down Netlify Dev server`
    )
    process.exit(code)
  }
  ps.on('close', handleProcessExit)
  ps.on('SIGINT', handleProcessExit)
  ps.on('SIGTERM', handleProcessExit)
  ;['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach(signal =>
    process.on(signal, () => {
      try {
        process.kill(-ps.pid)
      } catch (err) {
        // Ignore
      }
      process.exit()
    })
  )

  try {
    await waitPort({ port: settings.frameworkPort, output: 'silent' })
  } catch (err) {
    console.error(NETLIFYDEVERR, `Netlify Dev could not connect to localhost:${settings.frameworkPort}.`)
    console.error(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.frameworkPort}`)
    exit(1)
  }

  return ps
}

const getAddonsUrlsAndAddEnvVariablesToProcessEnv = async ({ api, site, flags }) => {
  if (site.id && !flags.offline) {
    const { addEnvVariables } = require('../../utils/dev')
    const addonUrls = await addEnvVariables(api, site)
    return addonUrls
  } else {
    return {}
  }
}

const addDotFileEnvs = async ({ site }) => {
  const envSettings = await getEnvSettings(site.root)
  if (envSettings.file) {
    console.log(
      `${NETLIFYDEVLOG} Overriding the following env variables with ${chalk.blue(
        path.relative(site.root, envSettings.file)
      )} file:`,
      chalk.yellow(Object.keys(envSettings.vars))
    )
    Object.entries(envSettings.vars).forEach(([key, val]) => (process.env[key] = val))
  }
}

class DevCommand extends Command {
  async run() {
    this.log(`${NETLIFYDEV}`)
    const { error: errorExit, log, warn, exit } = this
    const { flags } = this.parse(DevCommand)
    const { api, site, config } = this.netlify
    config.dev = { ...config.dev }
    config.build = { ...config.build }
    const devConfig = {
      framework: '#auto',
      ...(config.build.functions && { functions: config.build.functions }),
      ...(config.build.publish && { publish: config.build.publish }),
      ...config.dev,
      ...flags,
    }

    const addonUrls = await getAddonsUrlsAndAddEnvVariablesToProcessEnv({ api, site, flags })
    process.env.NETLIFY_DEV = 'true'
    await addDotFileEnvs({ site })

    let settings = {}
    try {
      settings = await serverSettings(devConfig, flags, site.root, log)
    } catch (err) {
      log(NETLIFYDEVERR, err.message)
      exit(1)
    }

    await startFunctionsServer({ settings, site, log, warn, errorExit, siteInfo: this.netlify.cachedConfig.siteInfo })
    await startFrameworkServer({ settings, log, exit })

    let { url } = await startProxy(settings, addonUrls, site.configPath, site.root)
    if (!url) {
      throw new Error('Unable to start proxy server')
    }

    if (flags.live) {
      process.env.BASE_URL = url = await startLiveTunnel({
        siteId: site.id,
        netlifyApiToken: api.accessToken,
        localPort: settings.port,
        log,
      })
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'dev',
        projectType: settings.framework || 'custom',
        live: flags.live || false,
      },
    })

    if (devConfig.autoLaunch && devConfig.autoLaunch !== false) {
      try {
        await open(url)
      } catch (err) {
        warn(NETLIFYDEVWARN, 'Error while opening dev server URL in browser', err.message)
      }
    }

    process.env.DEPLOY_URL = process.env.URL = url

    // boxen doesnt support text wrapping yet https://github.com/sindresorhus/boxen/issues/16
    const banner = require('wrap-ansi')(chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${url}`), 70)

    log(
      boxen(banner, {
        padding: 1,
        margin: 1,
        align: 'center',
        borderColor: '#00c7b7',
      })
    )
  }
}

DevCommand.description = `Local dev server
The dev command will run a local dev server with Netlify's proxy and redirect rules
`

DevCommand.examples = ['$ netlify dev', '$ netlify dev -c "yarn start"', '$ netlify dev -c hugo']

DevCommand.strict = false

DevCommand.flags = {
  ...DevCommand.flags,
  command: flags.string({
    char: 'c',
    description: 'command to run',
  }),
  port: flags.integer({
    char: 'p',
    description: 'port of netlify dev',
  }),
  targetPort: flags.integer({
    description: 'port of target app server',
  }),
  staticServerPort: flags.integer({
    description: 'port of the static app server used when no framework is detected',
    hidden: true,
  }),
  dir: flags.string({
    char: 'd',
    description: 'dir with static files',
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to serve',
  }),
  offline: flags.boolean({
    char: 'o',
    description: 'disables any features that require network access',
  }),
  live: flags.boolean({
    char: 'l',
    description: 'Start a public live session',
  }),
  trafficMesh: flags.boolean({
    char: 't',
    hidden: true,
    description: 'Uses Traffic Mesh for proxying requests',
  }),
}

module.exports = DevCommand
