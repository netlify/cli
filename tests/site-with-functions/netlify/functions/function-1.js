const { one } = require('../../lib/util')

// eslint-disable-next-line require-await
module.exports.handler = async () => ({ statusCode: 200, body: one })
