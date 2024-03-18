/**
 *
 * @param {import('@bugsnag/js').NotifiableError} error
 * @param {object} config
 * @param {import('@bugsnag/js').Event['severity']} config.severity
 * @param {Record<string, Record<string, any>>} [config.metadata]
 * @returns {Promise<void>}
 */
export declare const reportError: (error: any, config?: {}) => Promise<void>;
//# sourceMappingURL=report-error.d.ts.map