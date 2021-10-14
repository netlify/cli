const { builder } = require('@netlify/functions')

async function handler(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: `
    <!DOCTYPE html>
	    <html>
		    <body>
		      Hello World
		    </body>
    </html>
    `,
  }
}

exports.handler = builder(handler)
