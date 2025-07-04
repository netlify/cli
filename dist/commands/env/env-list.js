import ansiEscapes from 'ansi-escapes';
import AsciiTable from 'ascii-table';
import { isCI } from 'ci-info';
import inquirer from 'inquirer';
import logUpdate from 'log-update';
import { chalk, log, logJson } from '../../utils/command-helpers.js';
import { SUPPORTED_CONTEXTS, getEnvelopeEnv, getHumanReadableScopes } from '../../utils/env/index.js';
const MASK_LENGTH = 50;
const MASK = '*'.repeat(MASK_LENGTH);
const getTable = ({ environment, hideValues, scopesColumn, }) => {
    const table = new AsciiTable(`Environment variables`);
    const headings = ['Key', 'Value', scopesColumn && 'Scope'].filter(Boolean);
    table.setHeading(...headings);
    table.addRowMatrix(Object.entries(environment).map(([key, variable]) => [
        // Key
        key,
        // Value
        hideValues ? MASK : variable.value || ' ',
        // Scope
        scopesColumn && getHumanReadableScopes(variable.scopes),
    ].filter(Boolean)));
    return table.toString();
};
export const envList = async (options, command) => {
    const { context, scope } = options;
    const { api, cachedConfig, site } = command.netlify;
    const siteId = site.id;
    if (!siteId) {
        log('No project id found, please run inside a project folder or `netlify link`');
        return false;
    }
    const { env, siteInfo } = cachedConfig;
    let environment = await getEnvelopeEnv({ api, context, env, scope, siteInfo });
    // filter out general sources
    environment = Object.fromEntries(Object.entries(environment).filter(
    // @ts-expect-error TS(18046) - 'variable' is of type 'unknown'
    ([, variable]) => variable.sources[0] !== 'general' && variable.sources[0] !== 'internal'));
    // Return json response for piping commands
    if (options.json) {
        const envDictionary = Object.fromEntries(
        // @ts-expect-error TS(18046) - 'variable' is of type 'unknown'
        Object.entries(environment).map(([key, variable]) => [key, variable.value]));
        logJson(envDictionary);
        return false;
    }
    if (options.plain) {
        const plaintext = Object.entries(environment)
            // @ts-expect-error TS(18046) - 'variable' is of type 'unknown'
            .map(([key, variable]) => `${key}=${variable.value}`)
            .join('\n');
        log(plaintext);
        return false;
    }
    const forSite = `for project ${chalk.green(siteInfo.name)}`;
    const contextType = SUPPORTED_CONTEXTS.includes(context) ? 'context' : 'branch';
    const withContext = `in the ${chalk.magenta(options.context)} ${contextType}`;
    const withScope = scope === 'any' ? '' : `and ${chalk.yellow(options.scope)} scope`;
    if (Object.keys(environment).length === 0) {
        log(`No environment variables set ${forSite} ${withContext} ${withScope}`);
        return false;
    }
    // List environment in a table
    const count = Object.keys(environment).length;
    log(`${count} environment variable${count === 1 ? '' : 's'} ${forSite} ${withContext} ${withScope}`);
    if (isCI) {
        log(getTable({ environment, hideValues: false, scopesColumn: true }));
        return false;
    }
    logUpdate(getTable({ environment, hideValues: true, scopesColumn: true }));
    const { showValues } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'showValues',
            message: 'Show values?',
            default: false,
        },
    ]);
    if (showValues) {
        // since inquirer adds a prompt, we need to account for it when printing the table again
        log(ansiEscapes.eraseLines(3));
        logUpdate(getTable({ environment, hideValues: false, scopesColumn: true }));
        log(`${chalk.cyan('?')} Show values? ${chalk.cyan('Yes')}`);
    }
};
//# sourceMappingURL=env-list.js.map