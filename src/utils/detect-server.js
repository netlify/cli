const path = require('path')
const chalk = require('chalk')
const { NETLIFYDEVLOG } = require('./logo')
const inquirer = require('inquirer')
const fuzzy = require('fuzzy')
const fs = require('fs')

module.exports.serverSettings = async devConfig => {
  let settings = {}
  const detectorsFiles = fs
    .readdirSync(path.join(__dirname, '..', 'detectors'))
    .filter(x => x.endsWith('.js')) // only accept .js detector files

  if (typeof devConfig.framework !== 'string') throw new Error('Invalid "framework" option provided in config or flags')

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
      settings = chooseDefaultSettings(settingsArr[0])
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

      console.log(`Add "framework" = "${chosenSetting.framework}" to [dev] section of your netlify.toml to avoid this selection prompt next time`)
    }
  } else if (devConfig.framework === '#static') {
    // Do nothing
  } else {
    const detectorName = detectorsFiles.find(dt => `${dt}.js` === devConfig.framework)
    if (!detectorName) throw new Error('Unsupported value provided for "framework" option in config or flags')

    const detector = loadDetector(detectorName)
    const detectorResult = detector()
    if (!detectorResult) throw new Error(`Specified "framework" detector "${devConfig.framework}" did not pass requirements for your project`)

    settings = chooseDefaultSettings(detectorResult)
  }

  if (devConfig.command) {
    settings.command = assignLoudly(devConfig.command.split(/\s/)[0], settings.command || null, tellUser('command')) // if settings.command is empty, its bc no settings matched
    let devConfigArgs = devConfig.command.split(/\s/).slice(1)
    if (devConfigArgs[0] === 'run') devConfigArgs = devConfigArgs.slice(1)
    settings.args = assignLoudly(devConfigArgs, settings.command || null, tellUser('command')) // if settings.command is empty, its bc no settings matched
  }
  if (devConfig.port) settings.port = devConfig.port
  if (devConfig.targetPort) {
    settings.proxyPort = devConfig.targetPort
    settings.urlRegexp = devConfig.urlRegexp || new RegExp(`(http://)([^:]+:)${devConfig.targetPort}(/)?`, 'g')
  }
  settings.dist = devConfig.publish || settings.dist // dont loudassign if they dont need it

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

function chooseDefaultSettings(settings) {
  // vast majority of projects will only have one matching detector
  settings.args = settings.possibleArgsArrs[0] // just pick the first one
  if (!settings.args) {
    const { scripts } = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf8' }))
    // eslint-disable-next-line no-console
    console.error(
        'empty args assigned, this is an internal Netlify Dev bug, please report your settings and scripts so we can improve',
        { scripts, settings }
    )
    // eslint-disable-next-line no-process-exit
    process.exit(1)
  }

  return settings
}

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
        name: `[${chalk.yellow(setting.type)}] ${setting.command} ${args.join(' ')}`,
        value: { ...setting, args },
        short: setting.type + '-' + args.join(' ')
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
