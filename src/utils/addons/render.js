import AsciiTable from 'ascii-table';
import { chalk } from '../command-helpers.js';
// @ts-expect-error TS(7006) FIXME: Parameter 'values' implicitly has an 'any' type.
export const renderMissingValues = function (values, manifest) {
    const display = values
        // @ts-expect-error TS(7006) FIXME: Parameter 'item' implicitly has an 'any' type.
        .map((item) => {
        const itemDisplay = chalk.redBright.bold(`${item}`);
        const niceNameDisplay = manifest.config[item].displayName;
        return ` - ${itemDisplay} ${niceNameDisplay}`;
    })
        .join('\n');
    console.log(display);
};
// @ts-expect-error TS(7006) FIXME: Parameter 'addonName' implicitly has an 'any' type... Remove this comment to see the full error message
export const renderConfigValues = function (addonName, values, currentValue) {
    const table = new AsciiTable(`${addonName} add-on settings`);
    const tableHeader = currentValue
        ? ['Setting Name', 'Current Value', 'Description']
        : ['Setting Name', 'Description', 'Type', 'Required'];
    table.setHeading(...tableHeader);
    Object.keys(values).forEach((key) => {
        const { displayName, required, type } = values[key];
        const requiredText = required ? `true` : `false`;
        const typeInfo = type || '';
        const description = displayName || '';
        if (currentValue) {
            const value = currentValue[key] || 'Not supplied';
            table.addRow(key, value, description);
        }
        else {
            table.addRow(key, description, typeInfo, requiredText);
        }
    });
    console.log(table.toString());
};
