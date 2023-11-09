// @ts-check
import process from 'process'

import { intro, log, group, text, password, select, groupMultiselect,  multiselect, confirm, cancel, spinner, note, outro } from '@clack/prompts';
/**
 * The clack:prompts command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const clackPrompts = async (options, command) => {

  intro('clack intro - title')

	log.message('log message')
	log.info('log info')
	log.success('log success')
	log.step('log step')
	log.warn('log warn')
	log.error('log error')

  const project = await group(
		{
			path: () =>
				text({
					message: 'Enter a directory - will be validated',
					placeholder: './netlify-placeholder',
					validate: (value) => {
						if (!value) return 'Please enter a path.';
						if (value[0] !== '.') return 'Please enter a relative path.';
					},
				}),
			password: () =>
				password({
					message: 'Provide a password',
					validate: (value) => {
						if (!value) return 'Please enter a password.';
						if (value.length < 5) return 'Password should have at least 5 characters.';
					},
				}),
        // Can carry over results from previous steps!
			type: ({ results }) =>
				select({
					message: `Pick a project type within "${results.path}"`,
					initialValue: 'ts',
					maxItems: 5,
					options: [
						{ value: 'ts', label: 'TypeScript' },
						{ value: 'js', label: 'JavaScript' },
						{ value: 'rust', label: 'Rust' },
						{ value: 'go', label: 'Go' },
						{ value: 'python', label: 'Python' },
						{ value: 'coffee', label: 'CoffeeScript', hint: 'oh no' },
					],
				}),
			tools: () =>
				multiselect({
					message: 'Select additional tools - multiselect.',
					initialValues: ['prettier', 'eslint'],
					options: [
						{ value: 'prettier', label: 'Prettier', hint: 'recommended' },
						{ value: 'eslint', label: 'ESLint', hint: 'recommended' },
						{ value: 'stylelint', label: 'Stylelint' },
						{ value: 'gh-action', label: 'GitHub Action' },
					],
				}),
			groupedMultiselect: () =>
      groupMultiselect({
					message: 'Select whatever - grouped multiselect.',
					options: {
						"Good Options" : [{ value: 'a', label: 'a', hint: 'recommended' },
						{ value: 'b', label: 'b', hint: 'recommended' }],
						"Bad Options" : [{ value: 'c', label: 'c' },
						{ value: 'd', label: 'd' }],
      },
				}),
			install: () =>
				confirm({
					message: 'Install dependencies?',
					initialValue: false,
				}),
		},
		{
			onCancel: () => {
				cancel('Operation cancelled.');
				process.exit(0);
			},
		}
	);
    const something = true

	if (something) {
		const spin = spinner();
		spin.start('Installing via pnpm');
    // eslint-disable-next-line no-promise-executor-return
		await new Promise(resolve => setTimeout(resolve, 2000))
		spin.stop('Installed via pnpm');
	}

	const nextSteps = `cd ${project.path}        \n${project.install ? '' : 'pnpm install\n'}pnpm dev`;

	note(nextSteps, 'Next steps.');

	outro(`All done!`);
}


/**
 * Creates the `netlify clack:prompts` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createClackPromptsCommand = (program) =>
  program
    .command('clack:prompts')
    .description(
      `Displays @clack/prompts`
    )
    .action(clackPrompts)
