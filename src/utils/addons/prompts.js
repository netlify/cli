const chalk = require('chalk')

/* programmatically generate CLI prompts */
module.exports = function generatePrompts(settings) {
  const { config, configValues } = settings
  const configItems = Object.keys(config)

  return configItems
    .map((key, index) => {
      const setting = config[key]
      // const { type, displayName } = setting
      let prompt
      // Tell user to use types
      if (!setting.type) {
        console.log(`⚠️   ${chalk.yellowBright(`Warning: no \`type\` is set for config key: ${configItems[index]}`)}`)
        console.log(
          `It's highly recommended that you type your configuration values. It will help with automatic documentation, sharing of your services, and make your services configurable through a GUI`,
        )
        console.log('')
      }

      // Handle shorthand config. Probably will be removed. Severly limited + not great UX
      if (typeof setting === 'string' || typeof setting === 'boolean') {
        if (typeof setting === 'string') {
          prompt = {
            type: 'input',
            name: key,
            message: `Enter string value for '${key}':`,
          }
          // if current stage value set show as default
          if (configValues[key]) {
            prompt.default = configValues[key]
          }
        } else if (typeof setting === 'boolean') {
          prompt = {
            type: 'confirm',
            name: key,
            message: `Do you want '${key}':`,
          }
        }
        return prompt
      }

      // For future use. Once UX is decided
      // const defaultValidation = (setting.required) ? validateRequired : noValidate
      const defaultValidation = noValidate
      const validateFunction = setting.pattern ? validate(setting.pattern) : defaultValidation
      const isRequiredText = setting.required ? ` (${chalk.yellow('required')})` : ''
      if (setting.type === 'string' || setting.type.match(/string/)) {
        prompt = {
          type: 'input',
          name: key,
          message: `${chalk.white(key)}${isRequiredText} - ${setting.displayName}` || `Please enter value for ${key}`,
          validate: validateFunction,
        }
        // if value previously set show it
        if (configValues[key]) {
          prompt.default = configValues[key]
          // else show default value if provided
        } else if (setting.default) {
          prompt.default = setting.default
        }
        return prompt
      }

      return false
    })
    .filter(Boolean)
}

const noValidate = function () {
  return true
}

// Will use this soon
// function validateRequired(value) {
//   // eslint-disable-line
//   if (value) {
//     return true
//   }
//   return `Please enter a value this field is required`
// }

const validate = function (pattern) {
  return function validateValue(value) {
    const regex = new RegExp(pattern)
    if (value.match(regex)) {
      return true
    }
    return `Please enter a value matching regex pattern: /${chalk.yellowBright(pattern)}/`
  }
}
