import { methods } from '@netlify/api';
import AsciiTable from 'ascii-table';
import { chalk, logAndThrowError, exit, log, logJson } from '../../utils/command-helpers.js';
const isValidApiMethod = (api, apiMethod) => Object.hasOwn(api, apiMethod);
export const apiCommand = async (apiMethodName, options, command) => {
    const { api } = command.netlify;
    if (options.list) {
        const table = new AsciiTable(`Netlify API Methods`);
        table.setHeading('API Method', 'Docs Link');
        methods.forEach((method) => {
            const { operationId } = method;
            table.addRow(operationId, `https://open-api.netlify.com/#operation/${operationId}`);
        });
        log(table.toString());
        log();
        log('Above is a list of available API methods');
        log(`To run a method use "${chalk.cyanBright('netlify api methodName')}"`);
        exit();
    }
    if (!apiMethodName) {
        return logAndThrowError(`You must provide an API method. Run "netlify api --list" to see available methods`);
    }
    if (!(isValidApiMethod(api, apiMethodName) && typeof api[apiMethodName] === 'function')) {
        return logAndThrowError(`"${apiMethodName}"" is not a valid api method. Run "netlify api --list" to see available methods`);
    }
    const apiMethod = api[apiMethodName].bind(api);
    let payload;
    if (options.data) {
        payload = typeof options.data === 'string' ? JSON.parse(options.data) : options.data;
    }
    else {
        payload = {};
    }
    try {
        const apiResponse = await apiMethod(payload);
        logJson(apiResponse);
    }
    catch (error_) {
        return logAndThrowError(error_);
    }
};
//# sourceMappingURL=api.js.map