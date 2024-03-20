import process from 'process';
import { chalk, isDefaultJson } from '../command-helpers.js';
import { symbols } from './constants.js';
const argv = new Set(process.argv.slice(2));
export const coloredSymbol = (state) => {
    switch (state) {
        case 'initial':
        case 'active':
            return chalk.cyan(symbols.STEP_ACTIVE);
        case 'cancel':
            return chalk.red(symbols.STEP_CANCEL);
        case 'error':
            return chalk.yellow(symbols.STEP_ERROR);
        case 'submit':
            return chalk.cyan(symbols.STEP_SUBMIT);
        default:
            return chalk.cyan(symbols.STEP_ACTIVE);
    }
};
export const limitOptions = (params) => {
    const { cursor, options, style } = params;
    // We clamp to minimum 5 because anything less doesn't make sense UX wise
    const maxItems = params.maxItems === undefined ? Number.POSITIVE_INFINITY : Math.max(params.maxItems, 5);
    let slidingWindowLocation = 0;
    if (cursor >= slidingWindowLocation + maxItems - 3) {
        slidingWindowLocation = Math.max(Math.min(cursor - maxItems + 3, options.length - maxItems), 0);
    }
    else if (cursor < slidingWindowLocation + 2) {
        slidingWindowLocation = Math.max(cursor - 2, 0);
    }
    const shouldRenderTopEllipsis = maxItems < options.length && slidingWindowLocation > 0;
    const shouldRenderBottomEllipsis = maxItems < options.length && slidingWindowLocation + maxItems < options.length;
    return options.slice(slidingWindowLocation, slidingWindowLocation + maxItems).map((option, id, arr) => {
        const isTopLimit = id === 0 && shouldRenderTopEllipsis;
        const isBottomLimit = id === arr.length - 1 && shouldRenderBottomEllipsis;
        return isTopLimit || isBottomLimit ? chalk.dim('...') : style(option, id + slidingWindowLocation === cursor);
    });
};
// Adapted from https://github.com/chalk/ansi-regex
// @see LICENSE
export const ansiRegex = () => {
    const pattern = [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
    ].join('|');
    return new RegExp(pattern, 'g');
};
export const jsonOnly = () => argv.has('--json') || argv.has('--silent') || isDefaultJson();
