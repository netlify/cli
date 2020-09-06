const path = require('path')
const chalk = require('chalk')
const getPort = require('get-port')
const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./logo')
const inquirer = require('inquirer')
const fuzzy = require('fuzzy')
const fs = require('fs')

module.exports.serverSettings = async (devConfig, flags, projectDir, log) => {
  let settings = {}
  const detectorsFiles = fs.readdirSync(path.join(__dirname, '..', 'detectors')).filter(x => x.endsWith('.js')) // only accept .js detector files

  if (typeof devConfig.framework !== 'string') throw new Error('Invalid "framework" option provided in config')

  if (flags.dir) {
    settings = await getStaticServerSettings(settings, flags, projectDir, log)
    ;['command', 'targetPort'].forEach(p => {
      if (flags[p]) {
        throw new Error(
          `"${p}" option cannot be used in conjunction with "dir" flag which is used to run a static server`
        )
      }
    })
  } else if (devConfig.framework === '#auto' && !(devConfig.command && devConfig.targetPort)) {
    const settingsArr = []
    const detectors = detectorsFiles.map(det => {
      try {
        return loadDetector(det)
      } catch (err) {
        console.error(err)
        return null
      }
    })
    for (const detector of detectors) {
      const detectorResult = detector(projectDir)
      if (detectorResult) settingsArr.push(detectorResult)
    }
    if (settingsArr.length === 1) {
      settings = settingsArr[0]
      settings.args = chooseDefaultArgs(settings.possibleArgsArrs)
    } else if (settingsArr.length > 1) {
      /** multiple matching detectors, make the user choose */
      // lazy loading on purpose
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))
      const scriptInquirerOptions = formatSettingsArrForInquirer(settingsArr)
      const { chosenSetting } = await inquirer.prompt({
        name: 'chosenSetting',
        message: `Multiple possible start commands found`,
        type: 'autocomplete',
        async source(_, input) {
          if (!input || input === '') {
            return scriptInquirerOptions
          }
          // only show filtered results
          return filterSettings(scriptInquirerOptions, input)
        },
      })
      settings = chosenSetting // finally! we have a selected option

      log(
        `Add \`framework = "${chosenSetting.framework}"\` to [dev] section of your netlify.toml to avoid this selection prompt next time`
      )
    }
  } else if (devConfig.framework === '#custom' || (devConfig.command && devConfig.targetPort)) {
    settings.framework = '#custom'
    if (
      devConfig.framework &&
      !['command', 'targetPort'].every(p => Object.prototype.hasOwnProperty.call(devConfig, p))
    ) {
      throw new Error('"command" and "targetPort" properties are required when "framework" is set to "#custom"')
    }
    if (devConfig.framework !== '#custom' && devConfig.command && devConfig.targetPort) {
      throw new Error(
        '"framework" option must be set to "#custom" when specifying both "command" and "targetPort" options'
      )
    }
  } else if (devConfig.framework === '#static') {
    // Do nothing
  } else {
    const detectorName = detectorsFiles.find(dt => dt === `${devConfig.framework}.js`)
    if (!detectorName)
      throw new Error(
        'Unsupported value provided for "framework" option in config. Please use "#custom"' +
          ` if you're using a framework not intrinsically supported by Netlify Dev. E.g. with "command" and "targetPort" options.` +
          ` Or use one of following values: ${detectorsFiles.map(f => `"${path.parse(f).name}"`).join(', ')}`
      )

    const detector = loadDetector(detectorName)
    const detectorResult = detector(projectDir)
    if (!detectorResult)
      throw new Error(
        `Specified "framework" detector "${devConfig.framework}" did not pass requirements for your project`
      )

    settings = detectorResult
    settings.args = chooseDefaultArgs(detectorResult.possibleArgsArrs)
  }

  if (settings.command === 'npm' && !['start', 'run'].includes(settings.args[0])) {
    settings.args.unshift('run')
  }

  if (!settings.noCmd && devConfig.command) {
    console.log(
      `${NETLIFYDEVLOG} Overriding ${chalk.yellow('command')} with setting derived from netlify.toml [dev] block: `,
      devConfig.command
    )
    const [devConfigCommand, ...devConfigArgs] = devConfig.command.split(/\s+/)
    settings.command = devConfigCommand
    settings.args = devConfigArgs
  }

  settings.dist = flags.dir || devConfig.publish || settings.dist

  if (devConfig.targetPort) {
    if (devConfig.targetPort && typeof devConfig.targetPort !== 'number') {
      throw new Error('Invalid "targetPort" option specified. The value of "targetPort" option must be an integer')
    }

    if (devConfig.targetPort === devConfig.port) {
      throw new Error(
        '"port" and "targetPort" options cannot have same values. Please consult the documentation for more details: https://cli.netlify.com/netlify-dev#netlifytoml-dev-block'
      )
    }

    if (!settings.command)
      throw new Error(
        'No "command" specified or detected. The "command" option is required to use "targetPort" option.'
      )
    if (flags.dir)
      throw new Error(
        '"targetPort" option cannot be used in conjunction with "dir" flag which is used to run a static server.'
      )

    settings.frameworkPort = devConfig.targetPort
  }
  if (devConfig.port && devConfig.port === settings.frameworkPort) {
    throw new Error(
      'The "port" option you specified conflicts with the port of your application. Please use a different value for "port"'
    )
  }

  if (!settings.command && !settings.framework && !settings.noCmd) {
    settings = await getStaticServerSettings(settings, flags, projectDir, log)
  }

  if (!settings.frameworkPort) throw new Error('No "targetPort" option specified or detected.')

  if (devConfig.port && typeof devConfig.port !== 'number') {
    throw new Error('Invalid "port" option specified. The value of "port" option must be an integer')
  }

  if (devConfig.port && devConfig.port === settings.frameworkPort) {
    throw new Error(
      'The "port" option you specified conflicts with the port of your application. Please use a different value for "port"'
    )
  }
  const triedPort = devConfig.port || DEFAULT_PORT
  settings.port = await getPort({ port: triedPort })
  if (triedPort !== settings.port && devConfig.port) {
    throw new Error(`Could not acquire required "port": ${triedPort}`)
  }

  settings.jwtRolePath = devConfig.jwtRolePath || 'app_metadata.authorization.roles'
  settings.functions = devConfig.functions || settings.functions
  if (settings.functions) {
    settings.functionsPort = await getPort({ port: settings.functionsPort || 0 })
  }

  return settings
}

const DEFAULT_PORT = 8888

async function getStaticServerSettings(settings, flags, projectDir, log) {
  let dist = settings.dist
  if (flags.dir) {
    log(`${NETLIFYDEVWARN} Using simple static server because --dir flag was specified`)
    dist = flags.dir
  } else {
    log(`${NETLIFYDEVWARN} No app server detected and no "command" specified`)
  }
  if (!dist) {
    log(`${NETLIFYDEVLOG} Using current working directory`)
    log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from`)
    log(`${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`)
    log(`${NETLIFYDEVWARN} See docs at: https://cli.netlify.com/netlify-dev#project-detection`)
    dist = process.cwd()
  }
  log(`${NETLIFYDEVWARN} Running static server from "${path.relative(path.dirname(projectDir), dist)}"`)
  return {
    noCmd: true,
    frameworkPort: await getPort({ port: flags.staticServerPort || 3999 }),
    dist,
  }
}

function loadDetector(detectorName) {
  try {
    return require(path.join(__dirname, '..', 'detectors', detectorName))
  } catch (err) {
    throw new Error(
      `Failed to load detector: ${chalk.yellow(
        detectorName
      )}, this is likely a bug in the detector, please file an issue in netlify-cli\n ${err}`
    )
  }
}
module.exports.loadDetector = loadDetector

function chooseDefaultArgs(possibleArgsArrs) {
  // vast majority of projects will only have one matching detector
  const args = possibleArgsArrs[0] // just pick the first one
  if (!args) {
    const { scripts } = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }))
    const err = new Error(
      'Empty args assigned, this is an internal Netlify Dev bug, please report your settings and scripts so we can improve'
    )
    err.scripts = scripts
    err.possibleArgsArrs = possibleArgsArrs
    throw err
  }

  return args
}
module.exports.chooseDefaultArgs = chooseDefaultArgs

/** utilities for the inquirer section above */
function filterSettings(scriptInquirerOptions, input) {
  const filteredSettings = fuzzy.filter(
    input,
    scriptInquirerOptions.map(x => x.name)
  )
  const filteredSettingNames = filteredSettings.map(x => (input ? x.string : x))
  return scriptInquirerOptions.filter(t => filteredSettingNames.includes(t.name))
}

/** utiltities for the inquirer section above */
function formatSettingsArrForInquirer(settingsArr) {
  return [].concat(
    ...settingsArr.map(setting =>
      setting.possibleArgsArrs.map(args => ({
        name: `[${chalk.yellow(setting.framework)}] ${setting.command} ${args.join(' ')}`,
        value: { ...setting, args },
        short: setting.framework + '-' + args.join(' '),
      }))
    )
  )
}
