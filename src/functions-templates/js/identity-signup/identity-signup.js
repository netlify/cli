// note - this function MUST be named `identity-signup` to work
// we do not yet offer local emulation of this functionality in Netlify Dev
//
// more:
// https://www.netlify.com/blog/2019/02/21/the-role-of-roles-and-how-to-set-them-in-netlify-identity/
// https://www.netlify.com/docs/functions/#identity-and-functions

const handler = async function (event) {
  const data = JSON.parse(event.body)
  const { user } = data

  const responseBody = {
    app_metadata: {
      roles: user.email.split('@')[1] === 'trust-this-company.com' ? ['editor'] : ['visitor'],
      my_user_info: 'this is some user info',
    },
    user_metadata: {
      // append current user metadata
      ...user.user_metadata,
      custom_data_from_function: 'hurray this is some extra metadata',
    },
  }
  return {
    statusCode: 200,
    body: JSON.stringify(responseBody),
  }
}

module.exports = { handler }
