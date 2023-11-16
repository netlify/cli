
import { uninstall } from '../../utils/lm/install.mjs'

/**
 * The lm:uninstall command
 */
export const lmUninstall = async () => {
  await uninstall()
}
