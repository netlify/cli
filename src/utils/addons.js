/* eslint no-console: 0 */
const { getAddons, createAddon } = require('netlify/src/addons')
// const chalk = require("chalk");
// const fetch = require("node-fetch");

/** main section - shamelessly adapted from CLI. we can extract and dedupe later. */
/** but we can DRY things up later. */
// eslint-disable-next-line max-params
module.exports.createSiteAddon = async function(accessToken, addonName, siteId, siteData, log) {
  const addons = await getAddons(siteId, accessToken)
  if (typeof addons === 'object' && addons.error) {
    log('API Error', addons)
    return false
  }
  // Filter down addons to current args.name
  const currentAddon = addons.find(addon => addon.service_path === `/.netlify/${addonName}`)
  const rawFlags = {}

  if (currentAddon && currentAddon.id) {
    log(`The "${addonName} add-on" already exists for ${siteData.name}`)
    // // just exit
    // log()
    // const cmd = chalk.cyan(`\`netlify addons:config ${addonName}\``)
    // log(`- To update this add-on run: ${cmd}`)
    // const deleteCmd = chalk.cyan(`\`netlify addons:delete ${addonName}\``)
    // log(`- To remove this add-on run: ${deleteCmd}`)
    // log()
    return false
  }

  // const manifest = await getAddonManifest(addonName, accessToken);

  let configValues = rawFlags
  // if (manifest.config) {
  //   const required = requiredConfigValues(manifest.config);
  //   console.log(`Starting the setup for "${addonName} add-on"`);
  //   console.log();

  //   // const missingValues = missingConfigValues(required, rawFlags);
  //   // if (Object.keys(rawFlags).length) {
  //   //   const newConfig = updateConfigValues(manifest.config, {}, rawFlags)

  //   //   if (missingValues.length) {
  //   //     /* Warn user of missing required values */
  //   //     console.log(
  //   //       `${chalk.redBright.underline.bold(`Error: Missing required configuration for "${addonName} add-on"`)}`
  //   //     )
  //   //     console.log()
  //   //     render.missingValues(missingValues, manifest)
  //   //     console.log()
  //   //     const msg = `netlify addons:create ${addonName}`
  //   //     console.log(`Please supply the configuration values as CLI flags`)
  //   //     console.log()
  //   //     console.log(`Alternatively, you can run ${chalk.cyan(msg)} with no flags to walk through the setup steps`)
  //   //     console.log()
  //   //     return false
  //   //   }

  //   //   await createSiteAddon({
  //   //     addonName,
  //   //     settings: {
  //   //       siteId: siteId,
  //   //       addon: addonName,
  //   //       config: newConfig
  //   //     },
  //   //     accessToken,
  //   //     siteData
  //   //   })
  //   //   return false
  //   // }

  //   const words = `The ${addonName} add-on has the following configurable options:`;
  //   console.log(` ${chalk.yellowBright.bold(words)}`);
  //   render.configValues(addonName, manifest.config);
  //   console.log();
  //   console.log(` ${chalk.greenBright.bold("Lets configure those!")}`);

  //   console.log();
  //   console.log(
  //     ` - Hit ${chalk.white.bold("enter")} to confirm value or set empty value`
  //   );
  //   console.log(
  //     ` - Hit ${chalk.white.bold("ctrl + C")} to cancel & exit configuration`
  //   );
  //   console.log();

  //   const prompts = generatePrompts({
  //     config: manifest.config,
  //     configValues: rawFlags
  //   });

  //   const userInput = await inquirer.prompt(prompts);
  //   // Merge user input with the flags specified
  //   configValues = updateConfigValues(manifest.config, rawFlags, userInput);
  //   const missingRequiredValues = missingConfigValues(required, configValues);
  //   if (missingRequiredValues && missingRequiredValues.length) {
  //     missingRequiredValues.forEach(val => {
  //       console.log(
  //         `Missing required value "${val}". Please run the command again`
  //       );
  //     });
  //     return false;
  //   }
  // }

  await actuallyCreateSiteAddon({
    addonName,
    settings: {
      siteId: siteId,
      addon: addonName,
      config: configValues,
    },
    accessToken,
    siteData,
  })
  return addonName // we dont really use this right now but may be helpful to know that an addon installation was successful
}

async function actuallyCreateSiteAddon({ addonName, settings, accessToken, siteData }) {
  const addonResponse = await createAddon(settings, accessToken)

  if (addonResponse.code === 404) {
    console.log(`No add-on "${addonName}" found. Please double check your add-on name and try again`)
    return false
  }
  console.log(`Add-on "${addonName}" created for ${siteData.name}`)
  if (addonResponse.config && addonResponse.config.message) {
    console.log()
    console.log(`${addonResponse.config.message}`)
  }
  return addonResponse
}

/** all the utils used in the main section */

// async function getAddonManifest(addonName, netlifyApiToken) {
//   const url = `https://api.netlify.com/api/v1/services/${addonName}/manifest`;
//   const response = await fetch(url, {
//     method: "GET",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${netlifyApiToken}`
//     }
//   });

//   const data = await response.json();

//   if (response.status === 422) {
//     throw new Error(`Error ${JSON.stringify(data)}`);
//   }

//   return data;
// }

// function requiredConfigValues(config) {
//   return Object.keys(config).filter(key => {
//     return config[key].required;
//   });
// }

// function missingConfigValues(requiredConfig, providedConfig) {
//   return requiredConfig.filter(key => {
//     return !providedConfig[key];
//   });
// }

// function missingConfigValues(allowedConfig, currentConfig, newConfig) {
//   return Object.keys(allowedConfig).reduce((acc, key) => {
//     if (newConfig[key]) {
//       acc[key] = newConfig[key];
//       return acc;
//     }
//     acc[key] = currentConfig[key];
//     return acc;
//   }, {});
// }

// const chalk = require('chalk')

// /* programmatically generate CLI prompts */
// function generatePrompts(settings) {
//   const { config, configValues } = settings;
//   const configItems = Object.keys(config);

//   const prompts = configItems
//     .map((key, i) => {
//       const setting = config[key];
//       // const { type, displayName } = setting
//       let prompt;
//       // Tell user to use types
//       if (!setting.type) {
//         console.log(
//           `⚠️   ${chalk.yellowBright(
//             `Warning: no \`type\` is set for config key: ${configItems[i]}`
//           )}`
//         );
//         console.log(
//           `It's highly recommended that you type your configuration values. It will help with automatic documentation, sharing of your services, and make your services configurable through a GUI`
//         );
//         console.log("");
//       }

//       // Handle shorthand config. Probably will be removed. Severly limited + not great UX
//       if (typeof setting === "string" || typeof setting === "boolean") {
//         if (typeof setting === "string") {
//           prompt = {
//             type: "input",
//             name: key,
//             message: `Enter string value for '${key}':`
//           };
//           // if current stage value set show as default
//           if (configValues[key]) {
//             prompt.default = configValues[key];
//           }
//         } else if (typeof setting === "boolean") {
//           prompt = {
//             type: "confirm",
//             name: key,
//             message: `Do you want '${key}':`
//           };
//         }
//         return prompt;
//       }

//       // For future use. Once UX is decided
//       // const defaultValidation = (setting.required) ? validateRequired : noValidate
//       const defaultValidation = noValidate;
//       const validateFunction = setting.pattern
//         ? validate(setting.pattern)
//         : defaultValidation;
//       const isRequiredText = setting.required
//         ? ` (${chalk.yellow("required")})`
//         : "";
//       if (setting.type === "string" || setting.type.match(/string/)) {
//         prompt = {
//           type: "input",
//           name: key,
//           message:
//             `${chalk.white(key)}${isRequiredText} - ${setting.displayName}` ||
//             `Please enter value for ${key}`,
//           validate: validateFunction
//         };
//         // if value previously set show it
//         if (configValues[key]) {
//           prompt.default = configValues[key];
//           // else show default value if provided
//         } else if (setting.default) {
//           prompt.default = setting.default;
//         }
//         return prompt;
//       }
//       return undefined;
//     })
//     .filter(item => {
//       return typeof item !== "undefined";
//     });
//   return prompts;
// }

// function noValidate() {
//   return true;
// }

// function validate(pattern) {
//   return function(value) {
//     const regex = new RegExp(pattern);
//     if (value.match(regex)) {
//       return true;
//     }
//     return `Please enter a value matching regex pattern: /${chalk.yellowBright(
//       pattern
//     )}/`;
//   };
// }

// const chalk = require('chalk')
// const AsciiTable = require("ascii-table");

// function missingValues(values, manifest) {
//   const display = values
//     .map(item => {
//       const itemDisplay = chalk.redBright.bold(`${item}`);
//       const niceNameDisplay = manifest.config[item].displayName;
//       return ` - ${itemDisplay} ${niceNameDisplay}`;
//     })
//     .join("\n");
//   console.log(display);
// }

// function configValues(addonName, configValues, currentValue) {
//   const table = new AsciiTable(`${addonName} add-on settings`);

//   const tableHeader = currentValue
//     ? ["Setting Name", "Current Value", "Description"]
//     : ["Setting Name", "Description", "Type", "Required"];

//   table.setHeading(...tableHeader);

//   Object.keys(configValues).map(key => {
//     const { type, displayName, required } = configValues[key];
//     let requiredText = required ? `true` : `false`;
//     const typeInfo = type || "";
//     const description = displayName || "";
//     if (currentValue) {
//       const value = currentValue[key] || "Not supplied";
//       table.addRow(key, value, description);
//     } else {
//       table.addRow(key, description, typeInfo, requiredText);
//     }
//   });
//   console.log(table.toString());
// }
