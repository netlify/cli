
import { OptionValues } from 'commander'

import { installPlatform } from '../../utils/lm/install.mjs'
import { printBanner } from '../../utils/lm/ui.mjs'


export const lmInstall = async ({ force }: OptionValues) => {
  const installed = await installPlatform({ force })
  if (installed) {
    printBanner(force)
  }
}
