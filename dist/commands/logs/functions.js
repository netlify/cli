import inquirer from 'inquirer';
import { chalk, log } from '../../utils/command-helpers.js';
import { getWebSocket } from '../../utils/websockets/index.js';
import { CLI_LOG_LEVEL_CHOICES_STRING, LOG_LEVELS, LOG_LEVELS_LIST } from './log-levels.js';
function getLog(logData) {
    let logString = '';
    switch (logData.level) {
        case LOG_LEVELS.INFO:
            logString += chalk.blueBright(logData.level);
            break;
        case LOG_LEVELS.WARN:
            logString += chalk.yellowBright(logData.level);
            break;
        case LOG_LEVELS.ERROR:
            logString += chalk.redBright(logData.level);
            break;
        default:
            logString += logData.level;
            break;
    }
    return `${logString} ${logData.message}`;
}
export const logsFunction = async (functionName, options, command) => {
    const client = command.netlify.api;
    const { site } = command.netlify;
    const { id: siteId } = site;
    if (options.level && !options.level.every((level) => LOG_LEVELS_LIST.includes(level))) {
        log(`Invalid log level. Choices are:${CLI_LOG_LEVEL_CHOICES_STRING}`);
    }
    const levelsToPrint = options.level || LOG_LEVELS_LIST;
    // TODO: Update type once the open api spec is updated https://open-api.netlify.com/#tag/function/operation/searchSiteFunctions
    const { functions = [] } = (await client.searchSiteFunctions({ siteId: siteId }));
    if (functions.length === 0) {
        log(`No functions found for the project`);
        return;
    }
    let selectedFunction;
    if (functionName) {
        selectedFunction = functions.find((fn) => fn.n === functionName);
    }
    else {
        const { result } = await inquirer.prompt({
            name: 'result',
            type: 'list',
            message: 'Select a function',
            choices: functions.map((fn) => fn.n),
        });
        selectedFunction = functions.find((fn) => fn.n === result);
    }
    if (!selectedFunction) {
        log(`Could not find function ${functionName}`);
        return;
    }
    const { a: accountId, oid: functionId } = selectedFunction;
    const ws = getWebSocket('wss://socketeer.services.netlify.com/function/logs');
    ws.on('open', () => {
        ws.send(JSON.stringify({
            function_id: functionId,
            site_id: siteId,
            access_token: client.accessToken,
            account_id: accountId,
        }));
    });
    ws.on('message', (data) => {
        const logData = JSON.parse(data);
        if (!levelsToPrint.includes(logData.level.toLowerCase())) {
            return;
        }
        log(getLog(logData));
    });
    ws.on('close', () => {
        log('Connection closed');
    });
    ws.on('error', (err) => {
        log('Connection error');
        log(err);
    });
};
//# sourceMappingURL=functions.js.map