import { listFunctions } from '@netlify/zip-it-and-ship-it';
import { fileExistsAsync } from '../../lib/fs.js';
// @ts-expect-error TS(7006) FIXME: Parameter 'functionName' implicitly has an 'any' t... Remove this comment to see the full error message
const getUrlPath = (functionName) => `/.netlify/functions/${functionName}`;
export const BACKGROUND = '-background';
const JS = 'js';
// @ts-expect-error TS(7031) FIXME: Binding element 'mainFile' implicitly has an 'any'... Remove this comment to see the full error message
const addFunctionProps = ({ mainFile, name, runtime, schedule }) => {
    const urlPath = getUrlPath(name);
    const isBackground = name.endsWith(BACKGROUND);
    return { mainFile, name, runtime, urlPath, isBackground, schedule };
};
/**
 * @param {Record<string, { schedule?: string }>} functionConfigRecord
 * @returns {Record<string, { schedule?: string }>}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'functionConfigRecord' implicitly has an... Remove this comment to see the full error message
const extractSchedule = (functionConfigRecord) => 
// @ts-expect-error TS(2339) FIXME: Property 'schedule' does not exist on type 'unknow... Remove this comment to see the full error message
Object.fromEntries(Object.entries(functionConfigRecord).map(([name, { schedule }]) => [name, { schedule }]));
// @ts-expect-error TS(7006) FIXME: Parameter 'functionsSrcDir' implicitly has an 'any... Remove this comment to see the full error message
export const getFunctions = async (functionsSrcDir, config = {}) => {
    if (!(await fileExistsAsync(functionsSrcDir))) {
        return [];
    }
    const functions = await listFunctions(functionsSrcDir, {
        // @ts-expect-error TS(2339) FIXME: Property 'functions' does not exist on type '{}'.
        config: config.functions ? extractSchedule(config.functions) : undefined,
        parseISC: true,
    });
    // @ts-expect-error TS(2345) FIXME: Argument of type 'ListedFunction' is not assignabl... Remove this comment to see the full error message
    const functionsWithProps = functions.filter(({ runtime }) => runtime === JS).map((func) => addFunctionProps(func));
    return functionsWithProps;
};
//# sourceMappingURL=get-functions.js.map