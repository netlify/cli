// To learn about scheduled functions and supported cron extensions,
// see: https://ntl.fyi/sched-func
export default async (req) => {
  const { nextRun } = await req.json()

  console.log(`Next function run at ${nextRun}.`)

  return {
    statusCode: 200,
  }
}

export const config = {
  schedule: '@hourly',
}
