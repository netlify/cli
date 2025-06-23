import { NETLIFYDEVERR, NETLIFYDEVLOG } from '../../utils/command-helpers.js';
import { formatLambdaError, styleFunctionName } from './utils.js';
const BACKGROUND_FUNCTION_STATUS_CODE = 202;
export const handleBackgroundFunction = (functionName, response) => {
    console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`);
    response.status(BACKGROUND_FUNCTION_STATUS_CODE);
    response.end();
};
export const handleBackgroundFunctionResult = (functionName, err) => {
    if (err) {
        console.log(`${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`, formatLambdaError(err));
    }
    else {
        console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`);
    }
};
//# sourceMappingURL=background.js.map