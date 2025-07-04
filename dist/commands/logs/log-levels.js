// Source: Source: https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs.html#monitoring-cloudwatchlogs-advanced
export const LOG_LEVELS = {
    TRACE: 'TRACE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL',
};
export const LOG_LEVELS_LIST = Object.values(LOG_LEVELS).map((level) => level.toLowerCase());
export const CLI_LOG_LEVEL_CHOICES_STRING = LOG_LEVELS_LIST.map((level) => ` ${level}`);
//# sourceMappingURL=log-levels.js.map