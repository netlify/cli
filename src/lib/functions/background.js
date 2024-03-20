import { NETLIFYDEVERR, NETLIFYDEVLOG } from '../../utils/command-helpers.js';
import { formatLambdaError, styleFunctionName } from './utils.js';
const BACKGROUND_FUNCTION_STATUS_CODE = 202;
// @ts-expect-error TS(7006) FIXME: Parameter 'functionName' implicitly has an 'any' t... Remove this comment to see the full error message
export const handleBackgroundFunction = (functionName, response) => {
    console.log(`${NETLIFYDEVLOG} Queueing background function ${styleFunctionName(functionName)} for execution`);
    response.status(BACKGROUND_FUNCTION_STATUS_CODE);
    response.end();
};
// @ts-expect-error TS(7006) FIXME: Parameter 'functionName' implicitly has an 'any' t... Remove this comment to see the full error message
export const handleBackgroundFunctionResult = (functionName, err) => {
    if (err) {
        console.log(`${NETLIFYDEVERR} Error during background function ${styleFunctionName(functionName)} execution:`, formatLambdaError(err));
    }
    else {
        console.log(`${NETLIFYDEVLOG} Done executing background function ${styleFunctionName(functionName)}`);
    }
};
