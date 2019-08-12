exports.handler = (event, context, callback) => {
  const path = event.path.replace(/\.netlify\/functions\/[^\/]+/, "");
  const segments = path.split("/").filter(e => e);

  switch (event.httpMethod) {
    case "GET":
      // e.g. GET /.netlify/functions/url-shortener
      return require("./get-route").handler(event, context, callback);
    case "POST":
      // e.g. POST /.netlify/functions/url-shortener
      return require("./generate-route").handler(event, context, callback);
    case "PUT":
    // your code here
    case "DELETE":
    // your code here
  }
  return callback({
    statusCode: 500,
    body: "unrecognized HTTP Method, must be one of GET/POST/PUT/DELETE"
  });
};
