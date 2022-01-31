import { Handler, schedule } from '@netlify/functions';

const formatAsDateTime = (date: Date) => `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

const handler: Handler = () => {
    const currentExecutionTime = formatAsDateTime(new Date());
    console.log(`Function executed at ${currentExecutionTime}.`);

    return {
        statusCode: 200
    };
};

module.exports.handler = schedule("* * * * *", handler);

