import { type Spinner } from 'nanospinner';
/**
 * Creates a spinner with the following text
 */
export declare const startSpinner: ({ text }: {
    text: string;
}) => Spinner;
/**
 * Stops the spinner with the following text
 */
export declare const stopSpinner: ({ error, spinner, text }: {
    error?: boolean;
    spinner: Spinner;
    text?: string;
}) => void;
/**
 * Clears the spinner
 */
export declare const clearSpinner: ({ spinner }: {
    spinner: Spinner;
}) => void;
export type { Spinner };
//# sourceMappingURL=spinner.d.ts.map