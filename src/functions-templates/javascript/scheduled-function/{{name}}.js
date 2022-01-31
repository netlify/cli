const { schedule } = require('@netlify/functions')

// Sample function scheduled to run every minute using conventional cron syntax.
//
// Other supported extensions:
// - @yearly: once a year, on January 1st 00:00 (0 0 1 1 *)
// - @monthly: every month, on the first day of the month, at 00:00 (0 0 1 * *)
// - @weekly: every Monday, 00:00 (0 0 * * 0)
// - @daily: once a day, at 00:00 (0 0 * * *)
// - @hourly: every hour, at 0 seconds (0 * * * *)
//
module.exports.handler = schedule('* * * * *', async () => {
  console.log(`Function executed at ${new Date()}.`)

  return {
    statusCode: 200,
  }
})
