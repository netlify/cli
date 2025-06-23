import { createSpinner } from 'nanospinner';
const DOTS_SPINNER = {
    interval: 80,
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};
/**
 * Creates a spinner with the following text
 */
export const startSpinner = ({ text }) => createSpinner(text, DOTS_SPINNER).start();
/**
 * Stops the spinner with the following text
 */
export const stopSpinner = ({ error, spinner, text }) => {
    if (!spinner) {
        return;
    }
    if (error === true) {
        spinner.error(text);
    }
    else {
        spinner.stop(text);
    }
};
/**
 * Clears the spinner
 */
export const clearSpinner = ({ spinner }) => {
    spinner.clear();
};
//# sourceMappingURL=spinner.js.map