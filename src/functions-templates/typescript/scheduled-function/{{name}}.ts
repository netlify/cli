import { schedule } from '@netlify/functions';

export const handler = schedule("* * * * *", () => {
    console.log(`Function executed at ${new Date()}.`);

    return {
        statusCode: 200
    };
});
