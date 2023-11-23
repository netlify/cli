// @ts-check
import {
	ConfirmPrompt,
} from '@clack/core';

/**
 *
 * @param {*} opts
 * @returns
 */
export const confirm = (opts) => {
	const active = opts.active ?? 'Yes';
	const inactive = opts.inactive ?? 'No';
	return new ConfirmPrompt({
		active,
		inactive,
		initialValue: opts.initialValue ?? true,
		render() {
			const title = `${opts.message}\n`;
			const value = this.value ? active : inactive;

			switch (this.state) {
				case 'submit':
					return `${title} ${value}`;
				default: {
					return `${title} ${
						this.value
							? `${active.toUpperCase()}`
							: ` ${active}`
					} ${'/'} ${
						!this.value
							? `${inactive.toUpperCase()}`
							: `${inactive}`
					}`;
				}
			}
		},
	}).prompt() ;
};



/**
 * The clack:prompts command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const clackCore = async (options, command) => {
  confirm({message: 'Please confirm'})
}


/**
 * Creates the `netlify clack:prompts` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createClackCoreCommand = (program) =>
  program
    .command('clack:core')
    .description(
      `Displays @clack/core`
    )
    .action(clackCore)
