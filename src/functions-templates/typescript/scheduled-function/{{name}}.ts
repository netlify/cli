// @ts-expect-error TS(2307) FIXME: Cannot find module '@netlify/functions' or its cor... Remove this comment to see the full error message
import { schedule } from '@netlify/functions';

// To learn about scheduled functions and supported cron extensions, 
// see: https://ntl.fyi/sched-func
// @ts-expect-error TS(7006) FIXME: Parameter 'event' implicitly has an 'any' type.
export const handler = schedule("@hourly", async (event) => {
    const eventBody = JSON.parse(event.body);
    console.log(`Next function run at ${eventBody.next_run}.`);

    return {
        statusCode: 200
    };
});
