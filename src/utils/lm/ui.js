import os from 'os';
import boxen from 'boxen';
import { chalk, log } from '../command-helpers.js';
import { getShellInfo, isBinInPath } from './install.js';
/**
 * @param {boolean} force
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'force' implicitly has an 'any' type.
export const printBanner = function (force) {
    const print = force || !isBinInPath();
    const platform = os.platform();
    if (print && platform !== 'win32') {
        const { incFilePath } = getShellInfo();
        const banner = chalk.bold(`Run this command to use Netlify Large Media in your current shell\n\nsource ${incFilePath}`);
        log(boxen(banner, { padding: 1, margin: 1, align: 'center', borderColor: '#00c7b7' }));
    }
};
