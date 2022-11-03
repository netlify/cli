// @ts-expect-error TS(2307) FIXME: Cannot find module '@netlify/functions' or its cor... Remove this comment to see the full error message
import { Handler } from '@netlify/functions'

// @ts-expect-error TS(7006) FIXME: Parameter 'event' implicitly has an 'any' type.
export const handler: Handler = async (event, context) => {
  const { name = 'stranger' } = event.queryStringParameters

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Hello, ${name}!`,
    }),
  }
}
