import logSymbols from 'log-symbols';
import ora from 'ora';
/**
 * Creates a spinner with the following text
 * @param {object} config
 * @param {string} config.text
 * @returns {ora.Ora}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'text' implicitly has an 'any' typ... Remove this comment to see the full error message
export const startSpinner = ({ text }) => ora({
    text,
}).start();
/**
 * Stops the spinner with the following text
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @param {boolean} [config.error]
 * @param {string} [config.text]
 * @returns {void}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'error' implicitly has an 'any' ty... Remove this comment to see the full error message
export const stopSpinner = ({ error, spinner, text }) => {
    if (!spinner) {
        return;
    }
    // TODO: refactor no package needed `log-symbols` for that
    const symbol = error ? logSymbols.error : logSymbols.success;
    spinner.stopAndPersist({
        text,
        symbol,
    });
};
/**
 * Clears the spinner
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @returns {void}
 */
// @ts-expect-error TS(7031) FIXME: Binding element 'spinner' implicitly has an 'any' ... Remove this comment to see the full error message
export const clearSpinner = ({ spinner }) => {
    if (spinner) {
        spinner.stop();
    }
};
