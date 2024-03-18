import process from 'process';
import { block, ConfirmPrompt, GroupMultiSelectPrompt, isCancel, MultiSelectPrompt, PasswordPrompt, SelectKeyPrompt, SelectPrompt, TextPrompt, } from '@clack/core';
import isUnicodeSupported from 'is-unicode-supported';
import { cursor as ansiCursor, erase } from 'sisteransi';
import { chalk } from '../command-helpers.js';
import { reportError } from '../telemetry/report-error.js';
import { symbols } from './constants.js';
import { ansiRegex, coloredSymbol, jsonOnly, limitOptions } from './helpers.js';
const unicode = isUnicodeSupported();
export const text = (opts) => new TextPrompt({
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    render() {
        const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${opts.message}\n`;
        const placeholder = opts.placeholder
            ? chalk.inverse(opts.placeholder[0]) + chalk.dim(opts.placeholder.slice(1))
            : chalk.inverse(chalk.hidden('_'));
        const value = this.value ? this.valueWithCursor : placeholder;
        switch (this.state) {
            case 'error':
                return `${title.trim()}\n${chalk.yellow(symbols.BAR)}  ${value}\n${chalk.yellow(symbols.BAR_END)}  ${chalk.yellow(this.error)}\n`;
            case 'submit':
                return `${title}${chalk.gray(symbols.BAR)}  ${chalk.dim(this.value || opts.placeholder)}`;
            case 'cancel':
                return `${title}${chalk.gray(symbols.BAR)}  ${chalk.strikethrough(chalk.dim(this.value ?? ''))}${this.value?.trim() ? `\n${chalk.gray(symbols.BAR)}` : ''}`;
            default:
                return `${title}${chalk.cyan(symbols.BAR)}  ${value}\n${chalk.cyan(symbols.BAR_END)}\n`;
        }
    },
}).prompt();
export const password = (opts) => new PasswordPrompt({
    validate: opts.validate,
    mask: opts.mask ?? symbols.PASSWORD_MASK,
    render() {
        const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${opts.message}\n`;
        const value = this.valueWithCursor;
        const { masked } = this;
        switch (this.state) {
            case 'error':
                return `${title.trim()}\n${chalk.yellow(symbols.BAR)}  ${masked}\n${chalk.yellow(symbols.BAR_END)}  ${chalk.yellow(this.error)}\n`;
            case 'submit':
                return `${title}${chalk.gray(symbols.BAR)}  ${chalk.dim(masked)}`;
            case 'cancel':
                return `${title}${chalk.gray(symbols.BAR)}  ${chalk.strikethrough(chalk.dim(masked ?? ''))}${masked ? `\n${chalk.gray(symbols.BAR)}` : ''}`;
            default:
                return `${title}${chalk.cyan(symbols.BAR)}  ${value}\n${chalk.cyan(symbols.BAR_END)}\n`;
        }
    },
}).prompt();
export const confirm = async (opts) => {
    const active = opts.active ?? 'Yes';
    const inactive = opts.inactive ?? 'No';
    const confirmPrompt = new ConfirmPrompt({
        active,
        inactive,
        initialValue: opts.initialValue ?? true,
        render() {
            const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${opts.message}\n`;
            const value = this.value ? active : inactive;
            switch (this.state) {
                case 'submit':
                    return `${title}${chalk.gray(symbols.BAR)}  ${chalk.dim(value)}`;
                case 'cancel':
                    return `${title}${chalk.gray(symbols.BAR)}  ${chalk.strikethrough(chalk.dim(value))}\n${chalk.gray(symbols.BAR)}`;
                default: {
                    return `${title}${chalk.cyan(symbols.BAR)}  ${this.value
                        ? `${chalk.green(symbols.RADIO_ACTIVE)} ${active}`
                        : `${chalk.dim(symbols.RADIO_INACTIVE)} ${chalk.dim(active)}`} ${chalk.dim('/')} ${this.value
                        ? `${chalk.dim(symbols.RADIO_INACTIVE)} ${chalk.dim(inactive)}`
                        : `${chalk.green(symbols.RADIO_ACTIVE)} ${inactive}`}\n${chalk.cyan(symbols.BAR_END)}\n`;
                }
            }
        },
    }).prompt();
    const result = await confirmPrompt;
    if (isCancel(result)) {
        return false;
    }
    return result;
};
export const select = (opts) => {
    const opt = (option, state) => {
        const label = option.label ?? String(option.value);
        switch (state) {
            case 'selected':
                return `  ${label}`;
            case 'active':
                return `${chalk.green(symbols.RADIO_ACTIVE)} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
            case 'cancelled':
                return `${chalk.strikethrough(chalk.dim(label))}`;
            default:
                return `${chalk.dim(symbols.RADIO_INACTIVE)} ${chalk.dim(label)}`;
        }
    };
    return new SelectPrompt({
        options: opts.options,
        initialValue: opts.initialValue,
        render() {
            const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${chalk.bold(opts.message)}\n`;
            switch (this.state) {
                case 'submit':
                    return `${title}${chalk.gray(symbols.BAR)}  ${opt(this.options[this.cursor], 'selected')}`;
                case 'cancel':
                    return `${title}${chalk.gray(symbols.BAR)}  ${opt(this.options[this.cursor], 'cancelled')}\n${chalk.gray(symbols.BAR)}`;
                default: {
                    return `${title}${chalk.cyan(symbols.BAR)}  ${limitOptions({
                        cursor: this.cursor,
                        options: this.options,
                        maxItems: opts.maxItems,
                        style: (item, active) => opt(item, active ? 'active' : 'inactive'),
                    }).join(`\n${chalk.cyan(symbols.BAR)}  `)}\n${chalk.cyan(symbols.BAR_END)}\n`;
                }
            }
        },
    }).prompt();
};
// allows for the use of a) b) c) etc. options.
export const selectKey = (opts) => {
    const renderOption = (option, state = 'inactive') => {
        const label = option.label ?? String(option.value);
        if (state === 'selected') {
            return `${chalk.dim(label)}`;
        }
        if (state === 'cancelled') {
            return `${chalk.strikethrough(chalk.dim(label))}`;
        }
        if (state === 'active') {
            return `${chalk.bgCyan(chalk.gray(` ${option.value} `))} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
        }
        return `${chalk.gray(chalk.bgWhite(chalk.inverse(` ${option.value} `)))} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
    };
    return new SelectKeyPrompt({
        options: opts.options,
        initialValue: opts.initialValue,
        render() {
            const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${opts.message}\n`;
            const selectedOption = this.options.find((opt) => opt.value === this.value);
            if (!selectedOption)
                return;
            switch (this.state) {
                case 'submit': {
                    return `${title}${chalk.gray(symbols.BAR)}  ${renderOption(selectedOption, 'selected')}`;
                }
                case 'cancel':
                    return `${title}${chalk.gray(symbols.BAR)}  ${renderOption(this.options[0], 'cancelled')}\n${chalk.gray(symbols.BAR)}`;
                default: {
                    return `${title}${chalk.cyan(symbols.BAR)}  ${this.options
                        .map((option, id) => renderOption(option, id === this.cursor ? 'active' : 'inactive'))
                        .join(`\n${chalk.cyan(symbols.BAR)}  `)}\n${chalk.cyan(symbols.BAR_END)}\n`;
                }
            }
        },
    }).prompt();
};
export const multiselect = (opts) => {
    const renderOption = (option, state) => {
        const label = option.label ?? String(option.value);
        if (state === 'active') {
            return `${chalk.cyan(symbols.CHECKBOX_ACTIVE)} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
        }
        if (state === 'selected') {
            return `${chalk.green(symbols.CHECKBOX_SELECTED)} ${chalk.dim(label)}`;
        }
        if (state === 'cancelled') {
            return `${chalk.strikethrough(chalk.dim(label))}`;
        }
        if (state === 'active-selected') {
            return `${chalk.green(symbols.CHECKBOX_SELECTED)} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
        }
        if (state === 'submitted') {
            return `${chalk.dim(label)}`;
        }
        return `${chalk.dim(symbols.CHECKBOX_INACTIVE)} ${chalk.dim(label)}`;
    };
    const styleOption = (value) => (option, active) => {
        const selected = value.includes(option.value);
        if (active && selected) {
            return renderOption(option, 'active-selected');
        }
        if (selected) {
            return renderOption(option, 'selected');
        }
        return renderOption(option, active ? 'active' : 'inactive');
    };
    return new MultiSelectPrompt({
        options: opts.options,
        initialValues: opts.initialValues,
        required: opts.required ?? true,
        cursorAt: opts.cursorAt,
        validate(selected) {
            if (this.required && selected.length === 0)
                return `Please select at least one option.\n${chalk.reset(chalk.dim(`Press ${chalk.gray(chalk.bgWhite(chalk.inverse(' space ')))} to select, ${chalk.gray(chalk.bgWhite(chalk.inverse(' enter ')))} to submit`))}`;
        },
        render() {
            const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${opts.message}\n`;
            switch (this.state) {
                case 'submit': {
                    return `${title}${chalk.gray(symbols.BAR)}  ${this.options
                        .filter(({ value }) => this.value.includes(value))
                        .map((option) => renderOption(option, 'submitted'))
                        .join(chalk.dim(', ')) || chalk.dim('none')}`;
                }
                case 'cancel': {
                    const label = this.options
                        .filter(({ value }) => this.value.includes(value))
                        .map((option) => renderOption(option, 'cancelled'))
                        .join(chalk.dim(', '));
                    return `${title}${chalk.gray(symbols.BAR)}  ${label.trim() ? `${label}\n${chalk.gray(symbols.BAR)}` : ''}`;
                }
                case 'error': {
                    const footer = this.error
                        .split('\n')
                        .map((ln, id) => (id === 0 ? `${chalk.yellow(symbols.BAR_END)}  ${chalk.yellow(ln)}` : `   ${ln}`))
                        .join('\n');
                    return `${title + chalk.yellow(symbols.BAR)}  ${limitOptions({
                        options: this.options,
                        cursor: this.cursor,
                        maxItems: opts.maxItems,
                        style: styleOption(this.value),
                    }).join(`\n${chalk.yellow(symbols.BAR)}  `)}\n${footer}\n`;
                }
                default: {
                    return `${title}${chalk.cyan(symbols.BAR)}  ${limitOptions({
                        options: this.options,
                        cursor: this.cursor,
                        maxItems: opts.maxItems,
                        style: styleOption(this.value),
                    }).join(`\n${chalk.cyan(symbols.BAR)}  `)}\n${chalk.cyan(symbols.BAR_END)}\n`;
                }
            }
        },
    }).prompt();
};
export const groupMultiselect = (opts) => {
    const renderOption = (option, state, options = []) => {
        const label = option.label ?? String(option.value);
        const isItem = typeof option.group === 'string';
        const next = isItem && (options[options.indexOf(option) + 1] ?? { group: true });
        const isLast = isItem && next && next.group === true;
        const prefix = isItem ? `${isLast ? symbols.BAR_END : symbols.BAR} ` : '';
        if (state === 'active') {
            return `${chalk.dim(prefix)}${chalk.cyan(symbols.CHECKBOX_ACTIVE)} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
        }
        if (state === 'group-active') {
            return `${prefix}${chalk.cyan(symbols.CHECKBOX_ACTIVE)} ${chalk.dim(label)}`;
        }
        if (state === 'group-active-selected') {
            return `${prefix}${chalk.green(symbols.CHECKBOX_SELECTED)} ${chalk.dim(label)}`;
        }
        if (state === 'selected') {
            return `${chalk.dim(prefix)}${chalk.green(symbols.CHECKBOX_SELECTED)} ${chalk.dim(label)}`;
        }
        if (state === 'cancelled') {
            return `${chalk.strikethrough(chalk.dim(label))}`;
        }
        if (state === 'active-selected') {
            return `${chalk.dim(prefix)}${chalk.green(symbols.CHECKBOX_SELECTED)} ${label} ${option.hint ? chalk.dim(`(${option.hint})`) : ''}`;
        }
        if (state === 'submitted') {
            return `${chalk.dim(label)}`;
        }
        return `${chalk.dim(prefix)}${chalk.dim(symbols.CHECKBOX_INACTIVE)} ${chalk.dim(label)}`;
    };
    return new GroupMultiSelectPrompt({
        options: opts.options,
        initialValues: opts.initialValues,
        required: opts.required ?? true,
        cursorAt: opts.cursorAt,
        validate(selected) {
            if (this.required && selected.length === 0)
                return `Please select at least one option.\n${chalk.reset(chalk.dim(`Press ${chalk.gray(chalk.bgWhite(chalk.inverse(' space ')))} to select, ${chalk.gray(chalk.bgWhite(chalk.inverse(' enter ')))} to submit`))}`;
        },
        render() {
            const title = `${chalk.gray(symbols.BAR)}\n${coloredSymbol(this.state)}  ${opts.message}\n`;
            switch (this.state) {
                case 'submit': {
                    return `${title}${chalk.gray(symbols.BAR)}  ${this.options
                        .filter(({ value }) => this.value.includes(value))
                        .map((option) => renderOption(option, 'submitted'))
                        .join(chalk.dim(', '))}`;
                }
                case 'cancel': {
                    const label = this.options
                        .filter(({ value }) => this.value.includes(value))
                        .map((option) => renderOption(option, 'cancelled'))
                        .join(chalk.dim(', '));
                    return `${title}${chalk.gray(symbols.BAR)}  ${label.trim() ? `${label}\n${chalk.gray(symbols.BAR)}` : ''}`;
                }
                case 'error': {
                    const footer = this.error
                        .split('\n')
                        .map((ln, id) => (id === 0 ? `${chalk.yellow(symbols.BAR_END)}  ${chalk.yellow(ln)}` : `   ${ln}`))
                        .join('\n');
                    return `${title}${chalk.yellow(symbols.BAR)}  ${this.options
                        .map((option, id, options) => {
                        const selected = this.value.includes(option.value) || (option.group === true && this.isGroupSelected(`${option.value}`));
                        const active = id === this.cursor;
                        const groupActive = !active && typeof option.group === 'string' && this.options[this.cursor].value === option.group;
                        if (groupActive) {
                            return renderOption(option, selected ? 'group-active-selected' : 'group-active', options);
                        }
                        if (active && selected) {
                            return renderOption(option, 'active-selected', options);
                        }
                        if (selected) {
                            return renderOption(option, 'selected', options);
                        }
                        return renderOption(option, active ? 'active' : 'inactive', options);
                    })
                        .join(`\n${chalk.yellow(symbols.BAR)}  `)}\n${footer}\n`;
                }
                default: {
                    return `${title}${chalk.cyan(symbols.BAR)}  ${this.options
                        .map((option, id, options) => {
                        const selected = this.value.includes(option.value) || (option.group === true && this.isGroupSelected(`${option.value}`));
                        const active = id === this.cursor;
                        const groupActive = !active && typeof option.group === 'string' && this.options[this.cursor].value === option.group;
                        if (groupActive) {
                            return renderOption(option, selected ? 'group-active-selected' : 'group-active', options);
                        }
                        if (active && selected) {
                            return renderOption(option, 'active-selected', options);
                        }
                        if (selected) {
                            return renderOption(option, 'selected', options);
                        }
                        return renderOption(option, active ? 'active' : 'inactive', options);
                    })
                        .join(`\n${chalk.cyan(symbols.BAR)}  `)}\n${chalk.cyan(symbols.BAR_END)}\n`;
                }
            }
        },
    }).prompt();
};
const strip = (str) => str.replace(ansiRegex(), '');
export const note = (message = '', title = '') => {
    const lines = `\n${message}\n`.split('\n');
    const titleLen = strip(title).length;
    const len = Math.max(lines.reduce((sum, ln) => {
        ln = strip(ln);
        return ln.length > sum ? ln.length : sum;
    }, 0), titleLen) + 2;
    const msg = lines
        .map((ln) => `${chalk.gray(symbols.BAR)}  ${chalk.dim(ln)}${' '.repeat(len - strip(ln).length)}${chalk.gray(symbols.BAR)}`)
        .join('\n');
    process.stdout.write(`${chalk.gray(symbols.BAR)}\n${chalk.cyan(symbols.STEP_SUBMIT)}  ${chalk.reset(title)} ${chalk.gray(symbols.BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + symbols.CORNER_TOP_RIGHT)}\n${msg}\n${chalk.gray(symbols.CONNECT_LEFT + symbols.BAR_H.repeat(len + 2) + symbols.CORNER_BOTTOM_RIGHT)}\n`);
};
export const cancel = (message = '') => {
    process.stdout.write(`${chalk.gray(symbols.BAR_END)}  ${chalk.red(message)}\n\n`);
};
export const intro = (title = '') => {
    if (jsonOnly())
        return;
    process.stdout.write(`${chalk.gray(symbols.BAR_START)} ${chalk.bgCyan(chalk.black(` ◈ netlify  ${title} ◈ `))} \n`);
};
export const outro = ({ code = 0, exit, message }) => {
    if (jsonOnly())
        return;
    if (message) {
        process.stdout.write(`${chalk.gray(symbols.BAR)}\n${chalk.gray(symbols.BAR_END)}  ${message}\n\n`);
    }
    else {
        process.stdout.write(`${chalk.gray(symbols.BAR_END)}\n\n`);
    }
    if (exit)
        process.exit(code);
};
export const NetlifyLog = {
    message: (message = '', { error = false, noSpacing, symbol = chalk.gray(symbols.BAR), writeStream = process.stdout, } = {}) => {
        if (jsonOnly())
            return;
        const parts = noSpacing ? [] : [`${chalk.gray(symbols.BAR)}`];
        if (message) {
            const [firstLine, ...lines] = message.split('\n');
            parts.push(`${symbol}  ${firstLine}`, ...lines.map((ln) => (error ? ln : `${chalk.gray(symbols.BAR)}  ${ln}`)));
        }
        writeStream.write(`${parts.join('\n')}\n`);
    },
    info: (message) => {
        if (jsonOnly())
            return;
        NetlifyLog.message(message, { symbol: chalk.blue(symbols.INFO) });
    },
    success: (message) => {
        if (jsonOnly())
            return;
        NetlifyLog.message(message, { symbol: chalk.cyan(symbols.SUCCESS) });
    },
    step: (message) => {
        if (jsonOnly())
            return;
        NetlifyLog.message(message, { symbol: chalk.cyan(symbols.STEP_SUBMIT) });
    },
    warn: (message) => {
        if (jsonOnly())
            return;
        NetlifyLog.message(message, { symbol: chalk.yellow(symbols.WARN) });
    },
    /** alias for `log.warn()`. */
    warning: (message) => {
        if (jsonOnly())
            return;
        NetlifyLog.warn(message);
    },
    error: (message = '', options = {}) => {
        if (jsonOnly())
            return;
        const err = message instanceof Error
            ? message
            : // eslint-disable-next-line unicorn/no-nested-ternary
                typeof message === 'string'
                    ? new Error(message)
                    : { message, stack: undefined, name: 'Error' };
        if (options.exit === false) {
            if (process.env.DEBUG) {
                NetlifyLog.message(`Warning: ${err.stack?.split('\n')}\n`, {
                    symbol: chalk.red(symbols.ERROR),
                    writeStream: process.stderr,
                });
            }
            else {
                NetlifyLog.message(`${chalk.red(`${err.name}:`)} ${err.message}\n`, {
                    symbol: chalk.red(symbols.ERROR),
                    writeStream: process.stderr,
                });
            }
        }
        else {
            reportError(err, { severity: 'error' });
            NetlifyLog.message(`${chalk.red(`${err.name}:`)} ${err.message}\n`, {
                symbol: chalk.red(symbols.ERROR),
                writeStream: process.stderr,
                error: true,
            });
            process.exit(1);
        }
    },
};
export const spinner = () => {
    const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['•', 'o', 'O', '0'];
    const delay = unicode ? 80 : 120;
    let unblock;
    let loop;
    let isSpinnerActive = false;
    let _message = '';
    const handleExit = (code) => {
        const msg = code > 1 ? 'Something went wrong' : 'Canceled';
        if (isSpinnerActive)
            stop(msg, code);
    };
    const errorEventHandler = () => handleExit(2);
    const signalEventHandler = () => handleExit(1);
    const registerHooks = () => {
        // Reference: https://nodejs.org/api/process.html#event-uncaughtexception
        process.on('uncaughtExceptionMonitor', errorEventHandler);
        // Reference: https://nodejs.org/api/process.html#event-unhandledrejection
        process.on('unhandledRejection', errorEventHandler);
        // Reference Signal Events: https://nodejs.org/api/process.html#signal-events
        process.on('SIGINT', signalEventHandler);
        process.on('SIGTERM', signalEventHandler);
        process.on('exit', handleExit);
    };
    const clearHooks = () => {
        process.removeListener('uncaughtExceptionMonitor', errorEventHandler);
        process.removeListener('unhandledRejection', errorEventHandler);
        process.removeListener('SIGINT', signalEventHandler);
        process.removeListener('SIGTERM', signalEventHandler);
        process.removeListener('exit', handleExit);
    };
    const start = (msg = '') => {
        if (jsonOnly())
            return;
        isSpinnerActive = true;
        unblock = block();
        _message = msg.replace(/\.+$/, '');
        process.stdout.write(`${chalk.gray(symbols.BAR)}\n`);
        let frameIndex = 0;
        let dotsTimer = 0;
        registerHooks();
        // This ensures snapshot tests do not fail because a spinner is in a different position
        if (process.env.VITEST) {
            process.stdout.write(`${_message}...`);
            return;
        }
        loop = process.env.VITEST
            ? undefined
            : setInterval(() => {
                const frame = chalk.magenta(frames[frameIndex]);
                const loadingDots = '.'.repeat(Math.floor(dotsTimer)).slice(0, 3);
                process.stdout.write(ansiCursor.move(-999, 0));
                process.stdout.write(erase.down(1));
                process.stdout.write(`${frame}  ${_message}${loadingDots}`);
                frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0;
                dotsTimer = dotsTimer < frames.length ? dotsTimer + 0.125 : 0;
            }, delay);
    };
    const stop = (msg = '', code = 0) => {
        if (jsonOnly())
            return;
        _message = msg ?? _message;
        isSpinnerActive = false;
        loop && clearInterval(loop);
        const cancelOrError = code === 1 ? chalk.red(symbols.STEP_CANCEL) : chalk.red(symbols.STEP_ERROR);
        const step = code === 0 ? chalk.cyan(symbols.STEP_SUBMIT) : cancelOrError;
        process.stdout.write(ansiCursor.move(-999, 0));
        process.stdout.write(erase.down(1));
        process.stdout.write(`${step}  ${_message}\n`);
        clearHooks();
        unblock();
    };
    const message = (msg = '') => {
        if (jsonOnly())
            return;
        _message = msg ?? _message;
    };
    return {
        start,
        stop,
        message,
    };
};
/**
 * Define a group of prompts to be displayed
 * and return a results of objects within the group
 */
export const group = async (prompts, opts) => {
    const results = {};
    const promptNames = Object.keys(prompts);
    for (const name of promptNames) {
        const prompt = prompts[name];
        const result = await prompt({ results })?.catch((error) => {
            throw error;
        });
        // Pass the results to the onCancel function
        // so the user can decide what to do with the results
        // TODO: Switch to callback within core to avoid isCancel Fn
        if (typeof opts?.onCancel === 'function' && isCancel(result)) {
            results[name] = 'canceled';
            opts.onCancel({ results });
            continue;
        }
        results[name] = result;
    }
    return results;
};
/**
 * Define a group of tasks to be executed
 */
export const tasks = async (tasksToComplete) => {
    for (const task of tasksToComplete) {
        if (task.enabled === false)
            continue;
        const spin = spinner();
        spin.start(task.title);
        const result = await task.task(spin.message);
        spin.stop(result || task.title);
    }
};
