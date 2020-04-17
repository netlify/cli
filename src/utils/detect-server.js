const path = require('path')
const chalk = require('chalk')
const getPort = require('get-port')
const { NETLIFYDEVLOG, NETLIFYDEVWARN } = require('./logo')
const inquirer = require('inquirer')
const fuzzy = require('fuzzy')
const fs = require('fs')

module.exports.serverSettings = async (devConfig, flags, log) => {
  let settings = { env: { ...process.env } }
  const detectorsFiles = fs
    .readdirSync(path.join(__dirname, '..', 'detectors'))
    .filter(x => x.endsWith('.js')) // only accept .js detector files

  if (typeof devConfig.framework !== 'string') throw new Error('Invalid "framework" option provided in config')

  if (devConfig.framework === '#auto') {
    let settingsArr = []
    const detectors = detectorsFiles.map(det => {
      try {
        return loadDetector(det)
      } catch (err) {
        console.error(err)
        return null
      }
    })
    for (const i in detectors) {
      const detectorResult = detectors[i]()
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
        source: async function(_, input) {
          if (!input || input === '') {
            return scriptInquirerOptions
          }
          // only show filtered results
          return filterSettings(scriptInquirerOptions, input)
        }
      })
      settings = chosenSetting // finally! we have a selected option

      console.log(`Add \`framework = "${chosenSetting.framework}"\` to [dev] section of your netlify.toml to avoid this selection prompt next time`)
    }
  } else if (devConfig.framework === '#static') {
    settings.framework = devConfig.framework
  } else {
    const detectorName = detectorsFiles.find(dt => `${dt}.js` === devConfig.framework)
    if (!detectorName) throw new Error('Unsupported value provided for "framework" option in config')

    const detector = loadDetector(detectorName)
    const detectorResult = detector()
    if (!detectorResult) throw new Error(`Specified "framework" detector "${devConfig.framework}" did not pass requirements for your project`)

    settings.args = chooseDefaultArgs(detectorResult.possibleArgsArrs)
  }

  if (devConfig.command) {
    settings.command = assignLoudly(devConfig.command.split(/\s/)[0], settings.command || null, tellUser('command')) // if settings.command is empty, its bc no settings matched
    let devConfigArgs = devConfig.command.split(/\s/).slice(1)
    settings.args = assignLoudly(devConfigArgs, settings.command || null, tellUser('command')) // if settings.command is empty, its bc no settings matched
  }
  settings.dist = devConfig.publish || settings.dist // dont loudassign if they dont need it

  if (flags.dir || devConfig.framework === '#static' || (!settings.framework && !settings.proxyPort)) {
    let dist = settings.dist
    if (flags.dir) {
      log(`${NETLIFYDEVWARN} Using simple static server because --dir flag was specified`)
    } else if (devConfig.framework === '#static') {
      log(`${NETLIFYDEVWARN} Using simple static server because "framework" option was set to "#static" in config`)
    } else {
      log(`${NETLIFYDEVWARN} No app server detected, using simple static server`)
    }
    if (!dist) {
      log(`${NETLIFYDEVLOG} Using current working directory`)
      log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from.`)
      log(
        `${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`
      )
      log(
        `${NETLIFYDEVWARN} See docs at: https://cli.netlify.com/netlify-dev#project-detection`
      )
      log(`${NETLIFYDEVWARN} Using current working directory for now...`)
      dist = process.cwd()
    }
    settings = {
      env: { ...process.env },
      port: 8888,
      proxyPort: await getPort({ port: 3999 }),
      dist,
      ...(settings.command ? { command: settings.command, args: settings.args } : { noCmd: true }),
    }
  }

  settings.port = devConfig.port || settings.port
  if (devConfig.targetPort) {
    if (devConfig.targetPort === devConfig.port) {
      throw new Error('"port" and "targetPort" options cannot have same values. Please consult the documentation for more details: https://cli.netlify.com/netlify-dev#netlifytoml-dev-block')
    }
    settings.proxyPort = devConfig.targetPort
    settings.urlRegexp = devConfig.urlRegexp || new RegExp(`(http://)([^:]+:)${devConfig.targetPort}(/)?`, 'g')
  } else if (devConfig.port && devConfig.port === settings.proxyPort) {
    throw new Error('The "port" option you specified conflicts with the port of your application. Please use a different value for "port"')
  }

  const port = await getPort({ port: settings.port })
  if (port !== settings.port && devConfig.port) {
    throw new Error(`Could not acquire required "port": ${settings.port}`)
  }
  settings.port = port

  settings.jwtRolePath = devConfig.jwtRolePath || 'app_metadata.authorization.roles'
  settings.functionsPort = await getPort({ port: settings.functionsPort || 34567 })
  settings.functions = devConfig.functions || settings.functions

  return settings
}

const tellUser = settingsField => dV =>
    // eslint-disable-next-line no-console
    console.log(
        `${NETLIFYDEVLOG} Overriding ${chalk.yellow(settingsField)} with setting derived from netlify.toml [dev] block: `,
        dV
    )

function loadDetector(detectorName) {
  try {
    return require(path.join(__dirname, '..', 'detectors', detectorName))
  } catch (err) {
    throw new Error(`Failed to load detector: ${chalk.yellow(detectorName)}, this is likely a bug in the detector, please file an issue in netlify-cli\n ${err}`)
  }
}
module.exports.loadDetector = loadDetector

function chooseDefaultArgs(possibleArgsArrs) {
  // vast majority of projects will only have one matching detector
  const args = possibleArgsArrs[0] // just pick the first one
  if (!args) {
    const { scripts } = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }))
    const err = new Error('Empty args assigned, this is an internal Netlify Dev bug, please report your settings and scripts so we can improve')
    err.scripts = scripts
    err.possibleArgsArrs = possibleArgsArrs
    throw err
  }

  return args
}
module.exports.chooseDefaultArgs = chooseDefaultArgs

/** utilities for the inquirer section above */
function filterSettings(scriptInquirerOptions, input) {
  const filteredSettings = fuzzy.filter(input, scriptInquirerOptions.map(x => x.name))
  const filteredSettingNames = filteredSettings.map(x => (input ? x.string : x))
  return scriptInquirerOptions.filter(t => filteredSettingNames.includes(t.name))
}

/** utiltities for the inquirer section above */
function formatSettingsArrForInquirer(settingsArr) {
  let ans = []
  settingsArr.forEach(setting => {
    setting.possibleArgsArrs.forEach(args => {
      ans.push({
        name: `[${chalk.yellow(setting.framework)}] ${setting.command} ${args.join(' ')}`,
        value: { ...setting, args },
        short: setting.framework + '-' + args.join(' ')
      })
    })
  })
  return ans
}
// if first arg is undefined, use default, but tell user about it in case it is unintentional
function assignLoudly(
  optionalValue,
  defaultValue,
  // eslint-disable-next-line no-console
  tellUser = dV => console.log(`No value specified, using fallback of `, dV)
) {
  if (defaultValue === undefined) throw new Error('must have a defaultValue')
  if (defaultValue !== optionalValue && optionalValue === undefined) {
    tellUser(defaultValue)
    return defaultValue
  }
  return optionalValue
}
