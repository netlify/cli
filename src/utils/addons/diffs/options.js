import ansiStyles from 'ansi-styles';
import { Chalk } from 'chalk';
const forceColor = new Chalk({ level: 1 });
const colorTheme = {
    boolean: ansiStyles.yellow,
    circular: forceColor.grey('[Circular]'),
    date: {
        invalid: forceColor.red('invalid'),
        value: ansiStyles.blue,
    },
    diffGutters: {
        actual: `${forceColor.red('-')} `,
        expected: `${forceColor.green('+')} `,
        padding: '  ',
    },
    error: {
        ctor: {
            open: `${ansiStyles.grey.open}(`,
            close: `)${ansiStyles.grey.close}`,
        },
        name: ansiStyles.magenta,
    },
    function: {
        name: ansiStyles.blue,
        stringTag: ansiStyles.magenta,
    },
    global: ansiStyles.magenta,
    item: {
        after: forceColor.grey(','),
    },
    list: {
        openBracket: forceColor.grey('['),
        closeBracket: forceColor.grey(']'),
    },
    mapEntry: {
        after: forceColor.grey(','),
    },
    maxDepth: forceColor.grey('…'),
    null: ansiStyles.yellow,
    number: ansiStyles.yellow,
    object: {
        openBracket: forceColor.grey('{'),
        closeBracket: forceColor.grey('}'),
        ctor: ansiStyles.magenta,
        stringTag: {
            open: `${ansiStyles.magenta.open}@`,
            close: ansiStyles.magenta.close,
        },
        secondaryStringTag: {
            open: `${ansiStyles.grey.open}@`,
            close: ansiStyles.grey.close,
        },
    },
    property: {
        after: forceColor.grey(','),
        keyBracket: { open: forceColor.grey('['), close: forceColor.grey(']') },
        valueFallback: forceColor.grey('…'),
    },
    regexp: {
        source: {
            open: `${ansiStyles.blue.open}/`,
            close: `/${ansiStyles.blue.close}`,
        },
        flags: ansiStyles.yellow,
    },
    stats: { separator: forceColor.grey('---') },
    string: {
        open: ansiStyles.white.open,
        close: ansiStyles.white.close,
        line: { open: forceColor.white("'"), close: forceColor.white("'") },
        multiline: { start: forceColor.white('`'), end: forceColor.white('`') },
        controlPicture: ansiStyles.grey,
        diff: {
            insert: {
                open: ansiStyles.bgGreen.open + ansiStyles.black.open,
                close: ansiStyles.black.close + ansiStyles.bgGreen.close,
            },
            delete: {
                open: ansiStyles.bgRed.open + ansiStyles.black.open,
                close: ansiStyles.black.close + ansiStyles.bgRed.close,
            },
            equal: ansiStyles.white,
            insertLine: {
                open: ansiStyles.green.open,
                close: ansiStyles.green.close,
            },
            deleteLine: {
                open: ansiStyles.red.open,
                close: ansiStyles.red.close,
            },
        },
    },
    symbol: ansiStyles.yellow,
    typedArray: {
        bytes: ansiStyles.yellow,
    },
    undefined: ansiStyles.yellow,
};
// @ts-expect-error TS(7034) FIXME: Variable 'plugins' implicitly has type 'any[]' in ... Remove this comment to see the full error message
const plugins = [];
const theme = colorTheme;
// @ts-expect-error TS(7005) FIXME: Variable 'plugins' implicitly has an 'any[]' type.
export const concordanceOptions = { maxDepth: 3, plugins, theme };
// @ts-expect-error TS(7005) FIXME: Variable 'plugins' implicitly has an 'any[]' type.
export const concordanceDiffOptions = { maxDepth: 1, plugins, theme };
