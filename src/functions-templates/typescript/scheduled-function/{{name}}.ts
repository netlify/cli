import { schedule, Request } from '@netlify/functions';

// To learn about scheduled functions and supported cron extensions,
// see: https://ntl.fyi/sched-func
export default schedule("@hourly", async (req: Request) => {
    const eventBody = JSON.parse(req.body);
    console.log(`Next function run at ${eventBody.next_run}.`);

    return {
        statusCode: 200
    };
});
