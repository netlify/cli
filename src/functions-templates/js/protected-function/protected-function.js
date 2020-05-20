exports.handler = async (event, context) => {
  console.log('protected function!')
  // Reading the context.clientContext will give us the current user
  const claims = context.clientContext && context.clientContext.user
  console.log('user claims', claims)

  if (!claims) {
    console.log('No claims! Begone!')
    return {
      statusCode: 401,
      body: JSON.stringify({
        data: 'NOT ALLOWED',
      }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      data: 'auth true',
    }),
  }
}
