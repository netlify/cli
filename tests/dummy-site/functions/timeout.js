exports.handler = async (event, context) => {
  console.log('ding')
  // Wait for 4 seconds
  await new Promise((resolve, reject) => setTimeout(resolve, 4000))
  return {
    statusCode: 200,
    body: JSON.stringify('ping'),
  };
};

