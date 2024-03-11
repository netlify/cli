import { installPlatform } from '../../utils/lm/install.js';
import { printBanner } from '../../utils/lm/ui.js';
export const lmInstall = async ({ force }) => {
    const installed = await installPlatform({ force });
    if (installed) {
        printBanner(force);
    }
};
