import { chalk } from '../utils/command-helpers.mjs'

const RED_BACKGROUND = chalk.red('-background')
const [PRO, BUSINESS, ENTERPRISE] = ['Pro', 'Business', 'Enterprise'].map((plan) => chalk.magenta(plan))
export const BACKGROUND_FUNCTIONS_WARNING = `A serverless function ending in \`${RED_BACKGROUND}\` was detected.
Your team’s current plan doesn’t support Background Functions, which have names ending in \`${RED_BACKGROUND}\`.
To be able to deploy this function successfully either:
  - change the function name to remove \`${RED_BACKGROUND}\` and execute it synchronously
  - upgrade your team plan to a level that supports Background Functions (${PRO}, ${BUSINESS}, or ${ENTERPRISE})
`
export const MISSING_AWS_SDK_WARNING = `A function has thrown an error due to a missing dependency: ${chalk.yellow(
  'aws-sdk',
)}.
You should add this module to the project's dependencies, using your package manager of choice:

${chalk.yellow('npm install aws-sdk --save')} or ${chalk.yellow('yarn add aws-sdk')}

For more information, see https://ntl.fyi/cli-aws-sdk.`
