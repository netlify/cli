import ansiEscapes from 'ansi-escapes';
import AsciiTable from 'ascii-table';
import { isCI } from 'ci-info';
import inquirer from 'inquirer';
import logUpdate from 'log-update';
import { chalk, error, log, logJson } from '../../utils/command-helpers.js';
import { AVAILABLE_CONTEXTS, getEnvelopeEnv, getHumanReadableScopes } from '../../utils/env/index.js';
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
        log('No site id found, please run inside a site folder or `netlify link`');
        return false;
    }
    const { env, siteInfo } = cachedConfig;
    const isUsingEnvelope = siteInfo.use_envelope;
    let environment = env;
    if (isUsingEnvelope) {
        environment = await getEnvelopeEnv({ api, context, env, scope, siteInfo });
    }
    else if (context !== 'dev' || scope !== 'any') {
        error(`To specify a context or scope, please run ${chalk.yellow('netlify open:admin')} to open the Netlify UI and opt in to the new environment variables experience from Site settings`);
        return false;
    }
    // filter out general sources
    environment = Object.fromEntries(Object.entries(environment).filter(([, variable]) => variable.sources[0] !== 'general' && variable.sources[0] !== 'internal'));
    // Return json response for piping commands
    if (options.json) {
        const envDictionary = Object.fromEntries(Object.entries(environment).map(([key, variable]) => [key, variable.value]));
        logJson(envDictionary);
        return false;
    }
    if (options.plain) {
        const plaintext = Object.entries(environment)
            .map(([key, variable]) => `${key}=${variable.value}`)
            .join('\n');
        log(plaintext);
        return false;
    }
    const forSite = `for site ${chalk.green(siteInfo.name)}`;
    const contextType = AVAILABLE_CONTEXTS.includes(context) ? 'context' : 'branch';
    const withContext = isUsingEnvelope ? `in the ${chalk.magenta(options.context)} ${contextType}` : '';
    const withScope = isUsingEnvelope && scope !== 'any' ? `and ${chalk.yellow(options.scope)} scope` : '';
    if (Object.keys(environment).length === 0) {
        log(`No environment variables set ${forSite} ${withContext} ${withScope}`);
        return false;
    }
    // List environment in a table
    const count = Object.keys(environment).length;
    log(`${count} environment variable${count === 1 ? '' : 's'} ${forSite} ${withContext} ${withScope}`);
    if (isCI) {
        log(getTable({ environment, hideValues: false, scopesColumn: isUsingEnvelope }));
        return false;
    }
    logUpdate(getTable({ environment, hideValues: true, scopesColumn: isUsingEnvelope }));
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
        logUpdate(getTable({ environment, hideValues: false, scopesColumn: isUsingEnvelope }));
        log(`${chalk.cyan('?')} Show values? ${chalk.cyan('Yes')}`);
    }
};
