import process from 'process'

import {
	block,
	ConfirmPrompt,
	GroupMultiSelectPrompt,
	isCancel,
	MultiSelectPrompt,
	PasswordPrompt,
	SelectKeyPrompt,
	SelectPrompt,
	State,
	TextPrompt
} from '@clack/core';
import isUnicodeSupported from 'is-unicode-supported';
import { cursor as ansiCursor, erase } from 'sisteransi';

import { chalk } from '../command-helpers.js'

export { isCancel } from '@clack/core';

const unicode = isUnicodeSupported();
const symbolCharacter = (defaultCharacter: string, fallbackCharacter: string) => (unicode ? defaultCharacter : fallbackCharacter);
const S_STEP_ACTIVE = symbolCharacter('◆', '*');
const S_STEP_CANCEL = symbolCharacter('■', 'x');
const S_STEP_ERROR = symbolCharacter('▲', 'x');
const S_STEP_SUBMIT = symbolCharacter('◇', 'o');

const S_BAR_START = symbolCharacter('┌', 'T');
const S_BAR = symbolCharacter('│', '|');
const S_BAR_END = symbolCharacter('└', '—');

const S_RADIO_ACTIVE = symbolCharacter('●', '>');
const S_RADIO_INACTIVE = symbolCharacter('○', ' ');
const S_CHECKBOX_ACTIVE = symbolCharacter('◻', '[•]');
const S_CHECKBOX_SELECTED = symbolCharacter('◼', '[+]');
const S_CHECKBOX_INACTIVE = symbolCharacter('◻', '[ ]');
const S_PASSWORD_MASK = symbolCharacter('▪', '•');

const S_BAR_H = symbolCharacter('─', '-');
const S_CORNER_TOP_RIGHT = symbolCharacter('╮', '+');
const S_CONNECT_LEFT = symbolCharacter('├', '+');
const S_CORNER_BOTTOM_RIGHT = symbolCharacter('╯', '+');

const S_INFO = symbolCharacter('●', '•');
const S_SUCCESS = symbolCharacter('◆', '*');
const S_WARN = symbolCharacter('▲', '!');
const S_ERROR = symbolCharacter('■', 'x');

const symbol = (state: State) => {
	switch (state) {
		case 'initial':
		case 'active':
			return chalk.cyan(S_STEP_ACTIVE);
		case 'cancel':
			return chalk.red(S_STEP_CANCEL);
		case 'error':
			return chalk.yellow(S_STEP_ERROR);
		case 'submit':
			return chalk.cyan(S_STEP_SUBMIT);
    default:
      return chalk.cyan(S_STEP_ACTIVE);
	}
};

interface LimitOptionsParams<TOption> {
	options: TOption[];
	maxItems: number | undefined;
	cursor: number;
	style: (option: TOption, active: boolean) => string;
}

const limitOptions = <TOption>(params: LimitOptionsParams<TOption>): string[] => {
	const { cursor, options, style } = params;

	// We clamp to minimum 5 because anything less doesn't make sense UX wise
	const maxItems = params.maxItems === undefined ? Number.POSITIVE_INFINITY : Math.max(params.maxItems, 5);
	let slidingWindowLocation = 0;

	if (cursor >= slidingWindowLocation + maxItems - 3) {
		slidingWindowLocation = Math.max(Math.min(cursor - maxItems + 3, options.length - maxItems), 0);
	} else if (cursor < slidingWindowLocation + 2) {
		slidingWindowLocation = Math.max(cursor - 2, 0);
	}

	const shouldRenderTopEllipsis = maxItems < options.length && slidingWindowLocation > 0;
	const shouldRenderBottomEllipsis =
		maxItems < options.length && slidingWindowLocation + maxItems < options.length;

	return options
		.slice(slidingWindowLocation, slidingWindowLocation + maxItems)
		.map((option, id, arr) => {
			const isTopLimit = id === 0 && shouldRenderTopEllipsis;
			const isBottomLimit = id === arr.length - 1 && shouldRenderBottomEllipsis;
			return isTopLimit || isBottomLimit
				? chalk.dim('...')
				: style(option, id + slidingWindowLocation === cursor);
		});
};

export interface TextOptions {
	message: string;
	placeholder?: string;
	defaultValue?: string;
	initialValue?: string;
	validate?: (value: string) => string | void;
}
export const text = (opts: TextOptions) => new TextPrompt({
		validate: opts.validate,
		placeholder: opts.placeholder,
		defaultValue: opts.defaultValue,
		initialValue: opts.initialValue,
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
			const placeholder = opts.placeholder
				? chalk.inverse(opts.placeholder[0]) + chalk.dim(opts.placeholder.slice(1))
				: chalk.inverse(chalk.hidden('_'));
			const value = this.value ? this.valueWithCursor : placeholder;

			switch (this.state) {
				case 'error':
					return `${title.trim()}\n${chalk.yellow(S_BAR)}  ${value}\n${chalk.yellow(
						S_BAR_END
					)}  ${chalk.yellow(this.error)}\n`;
				case 'submit':
					return `${title}${chalk.gray(S_BAR)}  ${chalk.dim(this.value || opts.placeholder)}`;
				case 'cancel':
					return `${title}${chalk.gray(S_BAR)}  ${chalk.strikethrough(
						chalk.dim(this.value ?? '')
					)}${this.value?.trim() ? `\n${  chalk.gray(S_BAR)}` : ''}`;
				default:
					return `${title}${chalk.cyan(S_BAR)}  ${value}\n${chalk.cyan(S_BAR_END)}\n`;
			}
		},
	}).prompt() as Promise<string>;

export interface PasswordOptions {
	message: string;
	mask?: string;
	validate?: (value: string) => string | void;
}
export const password = (opts: PasswordOptions) => new PasswordPrompt({
		validate: opts.validate,
		mask: opts.mask ?? S_PASSWORD_MASK,
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
			const value = this.valueWithCursor;
			const {masked} = this;

			switch (this.state) {
				case 'error':
					return `${title.trim()}\n${chalk.yellow(S_BAR)}  ${masked}\n${chalk.yellow(
						S_BAR_END
					)}  ${chalk.yellow(this.error)}\n`;
				case 'submit':
					return `${title}${chalk.gray(S_BAR)}  ${chalk.dim(masked)}`;
				case 'cancel':
					return `${title}${chalk.gray(S_BAR)}  ${chalk.strikethrough(chalk.dim(masked ?? ''))}${
						masked ? `\n${  chalk.gray(S_BAR)}` : ''
					}`;
				default:
					return `${title}${chalk.cyan(S_BAR)}  ${value}\n${chalk.cyan(S_BAR_END)}\n`;
			}
		},
	}).prompt() as Promise<string>;

export interface ConfirmOptions {
	message: string;
	active?: string;
	inactive?: string;
	initialValue?: boolean;
}
export const confirm = (opts: ConfirmOptions) => {
	const active = opts.active ?? 'Yes';
	const inactive = opts.inactive ?? 'No';
	return new ConfirmPrompt({
		active,
		inactive,
		initialValue: opts.initialValue ?? true,
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;
			const value = this.value ? active : inactive;

			switch (this.state) {
				case 'submit':
					return `${title}${chalk.gray(S_BAR)}  ${chalk.dim(value)}`;
				case 'cancel':
					return `${title}${chalk.gray(S_BAR)}  ${chalk.strikethrough(
						chalk.dim(value)
					)}\n${chalk.gray(S_BAR)}`;
				default: {
					return `${title}${chalk.cyan(S_BAR)}  ${
						this.value
							? `${chalk.green(S_RADIO_ACTIVE)} ${active}`
							: `${chalk.dim(S_RADIO_INACTIVE)} ${chalk.dim(active)}`
					} ${chalk.dim('/')} ${
						this.value
              ? `${chalk.dim(S_RADIO_INACTIVE)} ${chalk.dim(inactive)}`
							: `${chalk.green(S_RADIO_ACTIVE)} ${inactive}`
					}\n${chalk.cyan(S_BAR_END)}\n`;
				}
			}
		},
	}).prompt() as Promise<boolean | symbol>;
};

type Primitive = Readonly<string | boolean | number>;

type Option<Value> = Value extends Primitive
	? { value: Value; label?: string; hint?: string }
	: { value: Value; label: string; hint?: string };

export interface SelectOptions<Value> {
	message: string;
	options: Option<Value>[];
	initialValue?: Value;
	maxItems?: number;
}

export const select = <Value>(opts: SelectOptions<Value>) => {
	const opt = (option: Option<Value>, state: 'inactive' | 'active' | 'selected' | 'cancelled') => {
		const label = option.label ?? String(option.value);
		switch (state) {
			case 'selected':
				return `  ${label}`;
			case 'active':
				return `${chalk.green(S_RADIO_ACTIVE)} ${label} ${
					option.hint ? chalk.dim(`(${option.hint})`) : ''
				}`;
			case 'cancelled':
				return `${chalk.strikethrough(chalk.dim(label))}`;
			default:
				return `${chalk.dim(S_RADIO_INACTIVE)} ${chalk.dim(label)}`;
		}
	};

	return new SelectPrompt({
		options: opts.options,
		initialValue: opts.initialValue,
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${chalk.bold(opts.message)}\n`;

			switch (this.state) {
				case 'submit':
					return `${title}${chalk.gray(S_BAR)}  ${opt(this.options[this.cursor], 'selected')}`;
				case 'cancel':
					return `${title}${chalk.gray(S_BAR)}  ${opt(
						this.options[this.cursor],
						'cancelled'
					)}\n${chalk.gray(S_BAR)}`;
				default: {
					return `${title}${chalk.cyan(S_BAR)}  ${limitOptions({
						cursor: this.cursor,
						options: this.options,
						maxItems: opts.maxItems,
						style: (item, active) => opt(item, active ? 'active' : 'inactive'),
					}).join(`\n${chalk.cyan(S_BAR)}  `)}\n${chalk.cyan(S_BAR_END)}\n`;
				}
			}
		},
	}).prompt() as Promise<Value>;
};

export const selectKey = <Value extends string>(opts: SelectOptions<Value>) => {
	const renderOption = (
		option: Option<Value>,
		state: 'inactive' | 'active' | 'selected' | 'cancelled' = 'inactive'
	) => {
		const label = option.label ?? String(option.value);
		if (state === 'selected') {
			return `${chalk.dim(label)}`;
		} if (state === 'cancelled') {
			return `${chalk.strikethrough(chalk.dim(label))}`;
		} if (state === 'active') {
			return `${chalk.bgCyan(chalk.gray(` ${option.value} `))} ${label} ${
				option.hint ? chalk.dim(`(${option.hint})`) : ''
			}`;
		}
		return `${chalk.gray(chalk.bgWhite(chalk.inverse(` ${option.value} `)))} ${label} ${
			option.hint ? chalk.dim(`(${option.hint})`) : ''
		}`;
	};

	return new SelectKeyPrompt({
		options: opts.options,
		initialValue: opts.initialValue,
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			switch (this.state) {
				case 'submit':
					return `${title}${chalk.gray(S_BAR)}  ${renderOption(
						this.options.find((opt) => opt.value === this.value)!,
						'selected'
					)}`;
				case 'cancel':
					return `${title}${chalk.gray(S_BAR)}  ${renderOption(this.options[0], 'cancelled')}\n${chalk.gray(
						S_BAR
					)}`;
				default: {
					return `${title}${chalk.cyan(S_BAR)}  ${this.options
						.map((option, id) => renderOption(option, id === this.cursor ? 'active' : 'inactive'))
						.join(`\n${chalk.cyan(S_BAR)}  `)}\n${chalk.cyan(S_BAR_END)}\n`;
				}
			}
		},
	}).prompt() as Promise<Value | symbol>;
};

export interface MultiSelectOptions<Value> {
	message: string;
	options: Option<Value>[];
	initialValues?: Value[];
	maxItems?: number;
	required?: boolean;
	cursorAt?: Value;
}
export const multiselect = <Value>(opts: MultiSelectOptions<Value>) => {
	const renderOption = (
		option: Option<Value>,
		state: 'inactive' | 'active' | 'selected' | 'active-selected' | 'submitted' | 'cancelled'
	) => {
		const label = option.label ?? String(option.value);
		if (state === 'active') {
			return `${chalk.cyan(S_CHECKBOX_ACTIVE)} ${label} ${
				option.hint ? chalk.dim(`(${option.hint})`) : ''
			}`;
		} if (state === 'selected') {
			return `${chalk.green(S_CHECKBOX_SELECTED)} ${chalk.dim(label)}`;
		} if (state === 'cancelled') {
			return `${chalk.strikethrough(chalk.dim(label))}`;
		} if (state === 'active-selected') {
			return `${chalk.green(S_CHECKBOX_SELECTED)} ${label} ${
				option.hint ? chalk.dim(`(${option.hint})`) : ''
			}`;
		} if (state === 'submitted') {
			return `${chalk.dim(label)}`;
		}
		return `${chalk.dim(S_CHECKBOX_INACTIVE)} ${chalk.dim(label)}`;
	};

	return new MultiSelectPrompt({
		options: opts.options,
		initialValues: opts.initialValues,
		required: opts.required ?? true,
		cursorAt: opts.cursorAt,
		validate(selected: Value[]) {
			if (this.required && selected.length === 0)
				return `Please select at least one option.\n${chalk.reset(
					chalk.dim(
						`Press ${chalk.gray(chalk.bgWhite(chalk.inverse(' space ')))} to select, ${chalk.gray(
							chalk.bgWhite(chalk.inverse(' enter '))
						)} to submit`
					)
				)}`;
		},
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			const styleOption = (option: Option<Value>, active: boolean) => {
				const selected = this.value.includes(option.value);
				if (active && selected) {
					return renderOption(option, 'active-selected');
				}
				if (selected) {
					return renderOption(option, 'selected');
				}
				return renderOption(option, active ? 'active' : 'inactive');
			};

			switch (this.state) {
				case 'submit': {
					return `${title}${chalk.gray(S_BAR)}  ${
						this.options
							.filter(({ value }) => this.value.includes(value))
							.map((option) => renderOption(option, 'submitted'))
							.join(chalk.dim(', ')) || chalk.dim('none')
					}`;
				}
				case 'cancel': {
					const label = this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => renderOption(option, 'cancelled'))
						.join(chalk.dim(', '));
					return `${title}${chalk.gray(S_BAR)}  ${
						label.trim() ? `${label}\n${chalk.gray(S_BAR)}` : ''
					}`;
				}
				case 'error': {
					const footer = this.error
						.split('\n')
						.map((ln, id) =>
							id === 0 ? `${chalk.yellow(S_BAR_END)}  ${chalk.yellow(ln)}` : `   ${ln}`
						)
						.join('\n');
					return (
						`${title +
						chalk.yellow(S_BAR)
						}  ${
						limitOptions({
							options: this.options,
							cursor: this.cursor,
							maxItems: opts.maxItems,
							style: styleOption,
						}).join(`\n${chalk.yellow(S_BAR)}  `)
						}\n${
						footer
						}\n`
					);
				}
				default: {
					return `${title}${chalk.cyan(S_BAR)}  ${limitOptions({
						options: this.options,
						cursor: this.cursor,
						maxItems: opts.maxItems,
						style: styleOption,
					}).join(`\n${chalk.cyan(S_BAR)}  `)}\n${chalk.cyan(S_BAR_END)}\n`;
				}
			}
		},
	}).prompt() as Promise<Value[] | symbol>;
};

export interface GroupMultiSelectOptions<Value> {
	message: string;
	options: Record<string, Option<Value>[]>;
	initialValues?: Value[];
	required?: boolean;
	cursorAt?: Value;
}
export const groupMultiselect = <Value>(opts: GroupMultiSelectOptions<Value>) => {
	const renderOption = (
		option: Option<Value>,
		state:
			| 'inactive'
			| 'active'
			| 'selected'
			| 'active-selected'
			| 'group-active'
			| 'group-active-selected'
			| 'submitted'
			| 'cancelled',
		options: Option<Value>[] = []
	) => {
		const label = option.label ?? String(option.value);
		const isItem = typeof (option as any).group === 'string';
		const next = isItem && (options[options.indexOf(option) + 1] ?? { group: true });
		const isLast = isItem && (next as any).group === true;
		const prefix = isItem ? `${isLast ? S_BAR_END : S_BAR} ` : '';

		if (state === 'active') {
			return `${chalk.dim(prefix)}${chalk.cyan(S_CHECKBOX_ACTIVE)} ${label} ${
				option.hint ? chalk.dim(`(${option.hint})`) : ''
			}`;
		} if (state === 'group-active') {
			return `${prefix}${chalk.cyan(S_CHECKBOX_ACTIVE)} ${chalk.dim(label)}`;
		} if (state === 'group-active-selected') {
			return `${prefix}${chalk.green(S_CHECKBOX_SELECTED)} ${chalk.dim(label)}`;
		} if (state === 'selected') {
			return `${chalk.dim(prefix)}${chalk.green(S_CHECKBOX_SELECTED)} ${chalk.dim(label)}`;
		} if (state === 'cancelled') {
			return `${chalk.strikethrough(chalk.dim(label))}`;
		} if (state === 'active-selected') {
			return `${chalk.dim(prefix)}${chalk.green(S_CHECKBOX_SELECTED)} ${label} ${
				option.hint ? chalk.dim(`(${option.hint})`) : ''
			}`;
		} if (state === 'submitted') {
			return `${chalk.dim(label)}`;
		}
		return `${chalk.dim(prefix)}${chalk.dim(S_CHECKBOX_INACTIVE)} ${chalk.dim(label)}`;
	};

	return new GroupMultiSelectPrompt({
		options: opts.options,
		initialValues: opts.initialValues,
		required: opts.required ?? true,
		cursorAt: opts.cursorAt,
		validate(selected: Value[]) {
			if (this.required && selected.length === 0)
				return `Please select at least one option.\n${chalk.reset(
					chalk.dim(
						`Press ${chalk.gray(chalk.bgWhite(chalk.inverse(' space ')))} to select, ${chalk.gray(
							chalk.bgWhite(chalk.inverse(' enter '))
						)} to submit`
					)
				)}`;
		},
		render() {
			const title = `${chalk.gray(S_BAR)}\n${symbol(this.state)}  ${opts.message}\n`;

			switch (this.state) {
				case 'submit': {
					return `${title}${chalk.gray(S_BAR)}  ${this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => renderOption(option, 'submitted'))
						.join(chalk.dim(', '))}`;
				}
				case 'cancel': {
					const label = this.options
						.filter(({ value }) => this.value.includes(value))
						.map((option) => renderOption(option, 'cancelled'))
						.join(chalk.dim(', '));
					return `${title}${chalk.gray(S_BAR)}  ${
						label.trim() ? `${label}\n${chalk.gray(S_BAR)}` : ''
					}`;
				}
				case 'error': {
					const footer = this.error
						.split('\n')
						.map((ln, id) =>
							id === 0 ? `${chalk.yellow(S_BAR_END)}  ${chalk.yellow(ln)}` : `   ${ln}`
						)
						.join('\n');
					return `${title}${chalk.yellow(S_BAR)}  ${this.options
						.map((option, id, options) => {
							const selected =
								this.value.includes(option.value) ||
								(option.group === true && this.isGroupSelected(`${option.value}`));
							const active = id === this.cursor;
							const groupActive =
								!active &&
								typeof option.group === 'string' &&
								this.options[this.cursor].value === option.group;
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
						.join(`\n${chalk.yellow(S_BAR)}  `)}\n${footer}\n`;
				}
				default: {
					return `${title}${chalk.cyan(S_BAR)}  ${this.options
						.map((option, id, options) => {
							const selected =
								this.value.includes(option.value) ||
								(option.group === true && this.isGroupSelected(`${option.value}`));
							const active = id === this.cursor;
							const groupActive =
								!active &&
								typeof option.group === 'string' &&
								this.options[this.cursor].value === option.group;
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
						.join(`\n${chalk.cyan(S_BAR)}  `)}\n${chalk.cyan(S_BAR_END)}\n`;
				}
			}
		},
	}).prompt() as Promise<Value[] | symbol>;
};

const strip = (str: string) => str.replace(ansiRegex(), '');
export const note = (message = '', title = '') => {
	const lines = `\n${message}\n`.split('\n');
	const titleLen = strip(title).length;
	const len =
		Math.max(
			lines.reduce((sum, ln) => {
				ln = strip(ln);
				return ln.length > sum ? ln.length : sum;
			}, 0),
			titleLen
		) + 2;
	const msg = lines
		.map(
			(ln) =>
				`${chalk.gray(S_BAR)}  ${chalk.dim(ln)}${' '.repeat(len - strip(ln).length)}${chalk.gray(
					S_BAR
				)}`
		)
		.join('\n');
	process.stdout.write(
		`${chalk.gray(S_BAR)}\n${chalk.cyan(S_STEP_SUBMIT)}  ${chalk.reset(title)} ${chalk.gray(
			S_BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + S_CORNER_TOP_RIGHT
		)}\n${msg}\n${chalk.gray(S_CONNECT_LEFT + S_BAR_H.repeat(len + 2) + S_CORNER_BOTTOM_RIGHT)}\n`
	);
};

export const cancel = (message = '') => {
	process.stdout.write(`${chalk.gray(S_BAR_END)}  ${chalk.red(message)}\n\n`);
};

export const intro = (title = '') => {
	process.stdout.write(`${chalk.gray(S_BAR_START)} ${chalk.bgCyan(chalk.black(` ◈ netlify  ${title} ◈ `))} \n`);
};

export const outro = (message = '') => {
	process.stdout.write(`${chalk.gray(S_BAR)}\n${chalk.gray(S_BAR_END)}  ${message}\n\n`);
};

export type LogMessageOptions = {
	symbol?: string;
};
export const log = {
	message: (message = '', { symbol = chalk.gray(S_BAR) }: LogMessageOptions = {}) => {
		const parts = [`${chalk.gray(S_BAR)}`];
		if (message) {
			const [firstLine, ...lines] = message.split('\n');
			parts.push(`${symbol}  ${firstLine}`, ...lines.map((ln) => `${chalk.gray(S_BAR)}  ${ln}`));
		}
		process.stdout.write(`${parts.join('\n')}\n`);
	},
	info: (message: string) => {
		log.message(message, { symbol: chalk.blue(S_INFO) });
	},
	success: (message: string) => {
		log.message(message, { symbol: chalk.cyan(S_SUCCESS) });
	},
	step: (message: string) => {
		log.message(message, { symbol: chalk.cyan(S_STEP_SUBMIT) });
	},
	warn: (message: string) => {
		log.message(message, { symbol: chalk.yellow(S_WARN) });
	},
	/** alias for `log.warn()`. */
	warning: (message: string) => {
		log.warn(message);
	},
	error: (message: string) => {
		log.message(message, { symbol: chalk.red(S_ERROR) });
	},
};

export const spinner = () => {
	const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['•', 'o', 'O', '0'];
	const delay = unicode ? 80 : 120;

	let unblock: () => void;
	let loop: NodeJS.Timeout;
	let isSpinnerActive = false;
	let _message = '';

	const handleExit = (code: number) => {
		const msg = code > 1 ? 'Something went wrong' : 'Canceled';
		if (isSpinnerActive) stop(msg, code);
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

	const start = (msg = ''): void => {
		isSpinnerActive = true;
		unblock = block();
		_message = msg.replace(/\.+$/, '');
		process.stdout.write(`${chalk.gray(S_BAR)}\n`);
		let frameIndex = 0;
		let dotsTimer = 0;
		registerHooks();
		loop = setInterval(() => {
			const frame = chalk.magenta(frames[frameIndex]);
			const loadingDots = '.'.repeat(Math.floor(dotsTimer)).slice(0, 3);
			process.stdout.write(ansiCursor.move(-999, 0));
			process.stdout.write(erase.down(1));
			process.stdout.write(`${frame}  ${_message}${loadingDots}`);
			frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0;
			dotsTimer = dotsTimer < frames.length ? dotsTimer + 0.125 : 0;
		}, delay);
	};

	const stop = (msg = '', code = 0): void => {
		_message = msg ?? _message;
		isSpinnerActive = false;
		clearInterval(loop);
		const step =
			code === 0
				? chalk.cyan(S_STEP_SUBMIT)
				: (code === 1
				? chalk.red(S_STEP_CANCEL)
				: chalk.red(S_STEP_ERROR));
		process.stdout.write(ansiCursor.move(-999, 0));
		process.stdout.write(erase.down(1));
		process.stdout.write(`${step}  ${_message}\n`);
		clearHooks();
		unblock();
	};

	const message = (msg = ''): void => {
		_message = msg ?? _message;
	};

	return {
		start,
		stop,
		message,
	};
};

// Adapted from https://github.com/chalk/ansi-regex
// @see LICENSE
function ansiRegex() {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
	].join('|');

	return new RegExp(pattern, 'g');
}

export type PromptGroupAwaitedReturn<T> = {
	[P in keyof T]: Exclude<Awaited<T[P]>, symbol>;
};

export interface PromptGroupOptions<T> {
	/**
	 * Control how the group can be canceled
	 * if one of the prompts is canceled.
	 */
	onCancel?: (opts: { results: Prettify<Partial<PromptGroupAwaitedReturn<T>>> }) => void;
}

type Prettify<T> = {
	[P in keyof T]: T[P];
} & {};

export type PromptGroup<T> = {
	[P in keyof T]: (opts: {
		results: Prettify<Partial<PromptGroupAwaitedReturn<Omit<T, P>>>>;
	}) => void | Promise<T[P] | void>;
};

/**
 * Define a group of prompts to be displayed
 * and return a results of objects within the group
 */
export const group = async <T>(
	prompts: PromptGroup<T>,
	opts?: PromptGroupOptions<T>
): Promise<Prettify<PromptGroupAwaitedReturn<T>>> => {
	const results = {} as any;
	const promptNames = Object.keys(prompts);

	for (const name of promptNames) {
		const prompt = prompts[name as keyof T];
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

export type Task = {
	/**
	 * Task title
	 */
	title: string;
	/**
	 * Task function
	 */
	task: (message: (string: string) => void) => string | Promise<string> | void | Promise<void>;

	/**
	 * If enabled === false the task will be skipped
	 */
	enabled?: boolean;
};

/**
 * Define a group of tasks to be executed
 */
export const tasks = async (tasksToComplete: Task[]) => {
	for (const task of tasksToComplete) {
		if (task.enabled === false) continue;

		const spin = spinner();
		spin.start(task.title);
		const result = await task.task(spin.message);
		spin.stop(result || task.title);
	}
};
