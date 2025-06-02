import { OptionValues } from "commander";
import isEmpty from 'lodash/isEmpty.js'
import BaseCommand from "../commands/base-command.js";
import { init } from "../commands/init/init.js";
import { log } from '../utils/command-helpers.js'

export const packagesThatNeedSites = ['@netlify/neon']

export async function handleExtensionRequirements(options: OptionValues, command: BaseCommand) {
    const { project } = command
    const { site, siteInfo } = command.netlify
    // Go through all the packages that need sites, see if they exist in the package.json
    // and if they do then we have to do a site init or whatever
    const packageJson = await project.getPackageJSON()
    const dependencies = packageJson.dependencies ?? {}
    const hasSiteData = Boolean(site.id ?? options.site) && !isEmpty(siteInfo)
    if (!hasSiteData) {
        for (const packageName of packagesThatNeedSites) {
            if (dependencies[packageName]) {
              log(`Found ${packageName} in package.json, initializing a site`)
              await init(options, command)
              return
            }
          }
    }
}