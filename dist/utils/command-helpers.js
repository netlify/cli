import { once } from 'events';
import os from 'os';
import fs from 'fs';
import process from 'process';
import { format, inspect } from 'util';
import { Chalk } from 'chalk';
import chokidar from 'chokidar';
import decache from 'decache';
import WSL from 'is-wsl';
import debounce from 'lodash/debounce.js';
import terminalLink from 'terminal-link';
import { startSpinner } from '../lib/spinner.js';
import getGlobalConfigStore from './get-global-config-store.js';
import getCLIPackageJson from './get-cli-package-json.js';
import { reportError } from './telemetry/report-error.js';
/** The parsed process argv without the binary only arguments and flags */
const argv = process.argv.slice(2);
/**
 * Chalk instance for CLI that can be initialized with no colors mode
 * needed for json outputs where we don't want to have colors
 * @param  {boolean} noColors - disable chalk colors
 * @return {import('chalk').ChalkInstance} - default or custom chalk instance
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'noColors' implicitly has an 'any' type.
const safeChalk = function (noColors) {
    if (noColors) {
        const colorlessChalk = new Chalk({ level: 0 });
        return colorlessChalk;
    }
    return new Chalk();
};
export const chalk = safeChalk(argv.includes('--json'));
/**
 * Adds the filler to the start of the string
 * @param {string} str
 * @param {number} count
 * @param {string} [filler]
 * @returns {string}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'str' implicitly has an 'any' type.
export const padLeft = (str, count, filler = ' ') => str.padStart(str.length + count, filler);
const platform = WSL ? 'wsl' : os.platform();
const arch = os.arch() === 'ia32' ? 'x86' : os.arch();
const { name, version: packageVersion } = await getCLIPackageJson();
export const version = packageVersion;
export const USER_AGENT = `${name}/${version} ${platform}-${arch} node-${process.version}`;
/** A list of base command flags that needs to be sorted down on documentation and on help pages */
const BASE_FLAGS = new Set(['--debug', '--http-proxy', '--http-proxy-certificate-filename']);
export const NETLIFY_CYAN = chalk.rgb(40, 180, 170);
export const NETLIFY_CYAN_HEX = '#28b5ac';
// TODO(serhalp) I *think* this "dev" naming is a vestige of the predecessor of the CLI? Rename to avoid
// confusion with `netlify dev` command?
export const NETLIFYDEVLOG = chalk.greenBright('⬥');
export const NETLIFYDEVWARN = chalk.yellowBright('⬥');
export const NETLIFYDEVERR = chalk.redBright('⬥');
export const BANG = process.platform === 'win32' ? '»' : '›';
/**
 * Sorts two options so that the base flags are at the bottom of the list
 * @param {import('commander').Option} optionA
 * @param {import('commander').Option} optionB
 * @returns {number}
 * @example
 * options.sort(sortOptions)
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'optionA' implicitly has an 'any' type.
export const sortOptions = (optionA, optionB) => {
    // base flags should be always at the bottom
    if (BASE_FLAGS.has(optionA.long) || BASE_FLAGS.has(optionB.long)) {
        return -1;
    }
    return optionA.long.localeCompare(optionB.long);
};
// Poll Token timeout 5 Minutes
const TOKEN_TIMEOUT = 3e5;
export const pollForToken = async ({ api, ticket, }) => {
    const spinner = startSpinner({ text: 'Waiting for authorization...' });
    try {
        const accessToken = await api.getAccessToken(ticket, { timeout: TOKEN_TIMEOUT });
        if (!accessToken) {
            return logAndThrowError('Could not retrieve access token');
        }
        return accessToken;
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error_.name === 'TimeoutError') {
            return logAndThrowError(`Timed out waiting for authorization. If you do not have a ${chalk.bold.greenBright('Netlify')} account, please create one at ${chalk.magenta('https://app.netlify.com/signup')}, then run ${chalk.cyanBright('netlify login')} again.`);
        }
        else {
            return logAndThrowError(error_);
        }
    }
    finally {
        spinner.stop();
        spinner.clear();
    }
};
export const getToken = async (tokenFromOptions) => {
    // 1. First honor command flag --auth
    if (tokenFromOptions) {
        return [tokenFromOptions, 'flag'];
    }
    // 2. then Check ENV var
    const { NETLIFY_AUTH_TOKEN } = process.env;
    if (NETLIFY_AUTH_TOKEN && NETLIFY_AUTH_TOKEN !== 'null') {
        return [NETLIFY_AUTH_TOKEN, 'env'];
    }
    // 3. If no env var use global user setting
    const globalConfig = await getGlobalConfigStore();
    const userId = globalConfig.get('userId');
    const tokenFromConfig = globalConfig.get(`users.${userId}.auth.token`);
    if (tokenFromConfig) {
        return [tokenFromConfig, 'config'];
    }
    return [null, 'not found'];
};
// 'api' command uses JSON output by default
// 'functions:invoke' need to return the data from the function as is
const isDefaultJson = () => argv[0] === 'functions:invoke' || (argv[0] === 'api' && !argv.includes('--list'));
/**
 * logs a json message
 */
export const logJson = (message = '') => {
    if (argv.includes('--json') || isDefaultJson()) {
        process.stdout.write(JSON.stringify(message, null, 2));
    }
};
export const log = (message = '', ...args) => {
    // If  --silent or --json flag passed disable logger
    if (argv.includes('--json') || argv.includes('--silent') || isDefaultJson()) {
        return;
    }
    message = typeof message === 'string' ? message : inspect(message);
    process.stdout.write(`${format(message, ...args)}\n`);
};
export const logPadded = (message = '', ...args) => {
    log('');
    log(message, ...args);
    log('');
};
/**
 * logs a warning message
 */
export const warn = (message = '') => {
    const bang = chalk.yellow(BANG);
    log(` ${bang}   Warning: ${message}`);
};
const toError = (val) => {
    if (val instanceof Error)
        return val;
    if (typeof val === 'string')
        return new Error(val);
    const err = new Error(inspect(val));
    err.stack = undefined;
    return err;
};
export const logAndThrowError = (message) => {
    const err = toError(message);
    void reportError(err, { severity: 'error' });
    throw err;
};
export const logError = (message) => {
    const err = toError(message);
    const bang = chalk.red(BANG);
    if (process.env.DEBUG) {
        process.stderr.write(` ${bang}   Warning: ${err.stack?.split('\n').join(`\n ${bang}   `)}\n`);
    }
    else {
        process.stderr.write(` ${bang}   ${chalk.red(`${err.name}:`)} ${err.message}\n`);
    }
};
export const exit = (code = 0) => {
    process.exit(code);
};
export const normalizeConfig = (config) => {
    // Unused var here is in order to omit 'publish' from build config
    const { publish, publishOrigin, ...build } = config.build;
    return publishOrigin === 'default' ? { ...config, build } : config;
};
const DEBOUNCE_WAIT = 100;
/**
 * Adds a file watcher to a path or set of paths and debounces the events.
 */
export const watchDebounced = async (target, { depth, ignored = [], onAdd = noOp, onChange = noOp, onUnlink = noOp }) => {
    const baseIgnores = [/\/(node_modules|.git)\//];
    const watcher = chokidar.watch(target, { depth, ignored: [...baseIgnores, ...ignored], ignoreInitial: true });
    await once(watcher, 'ready');
    let onChangeQueue = [];
    let onAddQueue = [];
    let onUnlinkQueue = [];
    const debouncedOnChange = debounce(() => {
        onChange(onChangeQueue);
        onChangeQueue = [];
    }, DEBOUNCE_WAIT);
    const debouncedOnAdd = debounce(() => {
        onAdd(onAddQueue);
        onAddQueue = [];
    }, DEBOUNCE_WAIT);
    const debouncedOnUnlink = debounce(() => {
        onUnlink(onUnlinkQueue);
        onUnlinkQueue = [];
    }, DEBOUNCE_WAIT);
    watcher
        .on('change', (path) => {
        // @ts-expect-error
        decache(path);
        onChangeQueue.push(path);
        debouncedOnChange();
    })
        .on('unlink', (path) => {
        // @ts-expect-error
        decache(path);
        onUnlinkQueue.push(path);
        debouncedOnUnlink();
    })
        .on('add', (path) => {
        // @ts-expect-error
        decache(path);
        onAddQueue.push(path);
        debouncedOnAdd();
    });
    return watcher;
};
export const getTerminalLink = (text, url) => terminalLink(text, url, { fallback: () => `${text} (${url})` });
export const isNodeError = (err) => err instanceof Error;
export const nonNullable = (value) => value !== null && value !== undefined;
export const noOp = () => {
    // no-op
};
export class GitHubAPIError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'GitHubAPIError';
    }
}
export const checkFileForLine = (filename, line) => {
    let filecontent = '';
    try {
        filecontent = fs.readFileSync(filename, 'utf8');
    }
    catch (error_) {
        return logAndThrowError(error_);
    }
    return !!filecontent.match(line);
};
export const TABTAB_CONFIG_LINE = '[[ -f ~/.config/tabtab/__tabtab.zsh ]] && . ~/.config/tabtab/__tabtab.zsh || true';
export const AUTOLOAD_COMPINIT = 'autoload -U compinit; compinit';
function pkgFromUserAgent(userAgent) {
    if (!userAgent)
        return undefined;
    const pkgSpec = userAgent.split(' ')[0];
    const [pkgManagerName] = pkgSpec.split('/');
    return pkgManagerName;
}
export const netlifyCommand = () => {
    const { npm_command, npm_config_user_agent, npm_lifecycle_event } = process.env;
    // Captures both `npx netlify ...` and `npm exec netlify ...`
    if (npm_lifecycle_event === 'npx') {
        return `npx netlify`;
    }
    // Captures `pnpm exec netlify ...`
    if (pkgFromUserAgent(npm_config_user_agent) === 'pnpm' && npm_command === 'exec') {
        return `pnpm exec netlify`;
    }
    // Captures `pnpx netlify ...`
    if (pkgFromUserAgent(npm_config_user_agent) === 'pnpm' && npm_command === 'run-script') {
        return `pnpx netlify`;
    }
    // Default
    return 'netlify';
};
//# sourceMappingURL=command-helpers.js.map