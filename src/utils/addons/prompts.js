import { chalk } from '../command-helpers.js';
/* programmatically generate CLI prompts */
// @ts-expect-error TS(7006) FIXME: Parameter 'settings' implicitly has an 'any' type.
export default function generatePrompts(settings) {
    const { config, configValues } = settings;
    const configItems = Object.keys(config);
    return configItems
        .map((key, index) => {
        const setting = config[key];
        // const { type, displayName } = setting
        let prompt;
        // Tell user to use types
        if (!setting.type) {
            console.log(`⚠️   ${chalk.yellowBright(`Warning: no \`type\` is set for config key: ${configItems[index]}`)}`);
            console.log(`It's highly recommended that you type your configuration values. It will help with automatic documentation, sharing of your services, and make your services configurable through a GUI`);
            console.log('');
        }
        // Handle shorthand config. Probably will be removed. Severely limited + not great UX
        if (typeof setting === 'string' || typeof setting === 'boolean') {
            if (typeof setting === 'string') {
                prompt = {
                    type: 'input',
                    name: key,
                    message: `Enter string value for '${key}':`,
                };
                // if current stage value set show as default
                if (configValues[key]) {
                    // @ts-expect-error TS(2339) FIXME: Property 'default' does not exist on type '{ type:... Remove this comment to see the full error message
                    prompt.default = configValues[key];
                }
            }
            else if (typeof setting === 'boolean') {
                prompt = {
                    type: 'confirm',
                    name: key,
                    message: `Do you want '${key}':`,
                };
            }
            return prompt;
        }
        // For future use. Once UX is decided
        // const defaultValidation = (setting.required) ? validateRequired : noValidate
        const defaultValidation = noValidate;
        const validateFunction = setting.pattern ? validate(setting.pattern) : defaultValidation;
        const isRequiredText = setting.required ? ` (${chalk.yellow('required')})` : '';
        if (setting.type === 'string' || /string/.test(setting.type)) {
            prompt = {
                type: 'input',
                name: key,
                message: `${chalk.white(key)}${isRequiredText} - ${setting.displayName}` || `Please enter value for ${key}`,
                validate: validateFunction,
            };
            // if value previously set show it
            if (configValues[key]) {
                // @ts-expect-error TS(2339) FIXME: Property 'default' does not exist on type '{ type:... Remove this comment to see the full error message
                prompt.default = configValues[key];
                // else show default value if provided
            }
            else if (setting.default) {
                // @ts-expect-error TS(2339) FIXME: Property 'default' does not exist on type '{ type:... Remove this comment to see the full error message
                prompt.default = setting.default;
            }
            return prompt;
        }
        return false;
    })
        .filter(Boolean);
}
const noValidate = function () {
    return true;
};
// Will use this soon
// function validateRequired(value) {
//   // eslint-disable-line
//   if (value) {
//     return true
//   }
//   return `Please enter a value this field is required`
// }
// @ts-expect-error TS(7006) FIXME: Parameter 'pattern' implicitly has an 'any' type.
const validate = function (pattern) {
    // @ts-expect-error TS(7006) FIXME: Parameter 'value' implicitly has an 'any' type.
    return function validateValue(value) {
        const regex = new RegExp(pattern);
        if (regex.test(value)) {
            return true;
        }
        return `Please enter a value matching regex pattern: /${chalk.yellowBright(pattern)}/`;
    };
};
