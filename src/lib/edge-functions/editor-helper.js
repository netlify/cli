import { env } from 'process';
import { runRecipe } from '../../commands/recipes/recipes.js';
import { NetlifyLog, confirm } from '../../utils/styles/index.js';
import { NETLIFYDEVLOG, chalk } from '../../utils/command-helpers.js';
const STATE_PROMPT_PROPERTY = 'promptVSCodeSettings';
// @ts-expect-error TS(7031) FIXME: Binding element 'NETLIFYDEVLOG' implicitly has an ... Remove this comment to see the full error message
export const promptEditorHelper = async ({ config, repositoryRoot, state }) => {
    // This prevents tests from hanging when running them inside the VS Code
    // terminal, as otherwise we'll show the prompt and wait for a response.
    if (env.NODE_ENV === 'test')
        return;
    const isVSCode = env.TERM_PROGRAM === 'vscode';
    const hasShownPrompt = Boolean(state.get(STATE_PROMPT_PROPERTY));
    const hasEdgeFunctions = Boolean(config.edge_functions && config.edge_functions.length !== 0);
    if (!isVSCode || hasShownPrompt || !hasEdgeFunctions) {
        return;
    }
    state.set(STATE_PROMPT_PROPERTY, true);
    const message = 'Would you like to configure VS Code to use Edge Functions?';
    const confirmVSCodeConfiguration = await confirm({ message, initialValue: true });
    if (!confirmVSCodeConfiguration) {
        NetlifyLog.info(`${NETLIFYDEVLOG} You can start this configuration manually by running ${chalk.magenta.bold('netlify recipes vscode')}.`);
        return;
    }
    await runRecipe({ config, recipeName: 'vscode', repositoryRoot });
};
