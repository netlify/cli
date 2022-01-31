import { Handler, schedule } from '@netlify/functions';

export const handler: Handler = schedule("* * * * *", () => {
    console.log(`Function executed at ${new Date()}.`);

    return {
        statusCode: 200
    };
});
