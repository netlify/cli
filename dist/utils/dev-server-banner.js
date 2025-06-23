import boxen from 'boxen';
import { chalk, log, NETLIFY_CYAN_HEX } from './command-helpers.js';
export const printBanner = (options) => {
    log(boxen(`Local dev server ready: ${chalk.inverse.cyan(options.url)}`, {
        padding: 1,
        margin: 1,
        textAlignment: 'center',
        borderStyle: 'round',
        borderColor: NETLIFY_CYAN_HEX,
        // This is an intentional half-width space to work around a unicode padding math bug in boxen
        title: '⬥ ',
        titleAlignment: 'center',
    }));
};
//# sourceMappingURL=dev-server-banner.js.map