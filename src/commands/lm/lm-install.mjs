// @ts-check
import { installPlatform } from '../../utils/lm/install.mjs'
import { printBanner } from '../../utils/lm/ui.mjs'

/**
 * The lm:install command
 * @param {import('commander').OptionValues} options
 */
export const lmInstall = async ({ force }) => {
  const installed = await installPlatform({ force })
  if (installed) {
    printBanner(force)
  }
}
