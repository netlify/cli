/**
 * Creates a spinner with the following text
 * @param {object} config
 * @param {string} config.text
 * @returns {ora.Ora}
 */
export declare const startSpinner: ({ text }: {
    text: any;
}) => import("ora").Ora;
/**
 * Stops the spinner with the following text
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @param {boolean} [config.error]
 * @param {string} [config.text]
 * @returns {void}
 */
export declare const stopSpinner: ({ error, spinner, text }: {
    error: any;
    spinner: any;
    text: any;
}) => void;
/**
 * Clears the spinner
 * @param {object} config
 * @param {ora.Ora} config.spinner
 * @returns {void}
 */
export declare const clearSpinner: ({ spinner }: {
    spinner: any;
}) => void;
//# sourceMappingURL=spinner.d.ts.map