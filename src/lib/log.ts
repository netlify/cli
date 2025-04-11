import { ansis } from '../utils/command-helpers.js'

const RED_BACKGROUND = ansis.red('-background')
const [PRO, BUSINESS, ENTERPRISE] = ['Pro', 'Business', 'Enterprise'].map((plan) => ansis.magenta(plan))
export const BACKGROUND_FUNCTIONS_WARNING = `A serverless function ending in \`${RED_BACKGROUND}\` was detected.
Your team’s current plan doesn’t support Background Functions, which have names ending in \`${RED_BACKGROUND}\`.
To be able to deploy this function successfully either:
  - change the function name to remove \`${RED_BACKGROUND}\` and execute it synchronously
  - upgrade your team plan to a level that supports Background Functions (${PRO}, ${BUSINESS}, or ${ENTERPRISE})
`
export const MISSING_AWS_SDK_WARNING = `A function has thrown an error due to a missing dependency: ${ansis.yellow(
  'aws-sdk',
)}.
You should add this module to the project's dependencies, using your package manager of choice:

${ansis.yellow('npm install aws-sdk --save')} or ${ansis.yellow('yarn add aws-sdk')}

For more information, see https://ntl.fyi/cli-aws-sdk.`
