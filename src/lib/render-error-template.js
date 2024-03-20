import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// @ts-expect-error TS(7034) FIXME: Variable 'errorTemplateFile' implicitly has type '... Remove this comment to see the full error message
let errorTemplateFile;
const dir = dirname(fileURLToPath(import.meta.url));
// @ts-expect-error TS(7006) FIXME: Parameter 'errString' implicitly has an 'any' type... Remove this comment to see the full error message
const renderErrorTemplate = async (errString, templatePath, functionType) => {
    const errorDetailsRegex = /<!--@ERROR-DETAILS-->/g;
    const functionTypeRegex = /<!--@FUNCTION-TYPE-->/g;
    try {
        // @ts-expect-error TS(7005) FIXME: Variable 'errorTemplateFile' implicitly has an 'an... Remove this comment to see the full error message
        errorTemplateFile = errorTemplateFile || (await readFile(join(dir, templatePath), 'utf-8'));
        return errorTemplateFile.replace(errorDetailsRegex, errString).replace(functionTypeRegex, functionType);
    }
    catch {
        return errString;
    }
};
export default renderErrorTemplate;
