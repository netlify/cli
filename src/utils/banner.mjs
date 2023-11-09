import boxen from 'boxen';
import { chalk, log, NETLIFYDEVLOG } from './command-helpers.mjs';
// @ts-expect-error TS(7031) FIXME: Binding element 'url' implicitly has an 'any' type... Remove this comment to see the full error message
export const printBanner = ({ url }) => {
    const banner = chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${url}`);
    log(boxen(banner, {
        padding: 1,
        margin: 1,
        align: 'center',
        borderColor: '#00c7b7',
    }));
};
