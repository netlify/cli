import { uninstall } from '../../utils/lm/install.js';
/**
 * The lm:uninstall command
 */
export const lmUninstall = async () => {
    await uninstall();
};
