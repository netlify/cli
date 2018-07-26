# @netlify/js-api

A Netlify [open-api](https://github.com/netlify/open-api) client that works in the browser and Node.js.

## Usage

```js
const NetlifyAPI = require('../utils/api')
const client = new NetlifyAPI('1234myAccessToken')
const sites = await client.listSites()
```

## API

### `client = new NetlifyAPI([accessToken], [opts])`

Create a new instance of the Netlify API client with the provided `accessToken`.

`accessToken` is optional.  Without it, you can't make authorized requests.

`opts` includes:

```js
{
  userAgent: 'netlify-js-client',
  scheme: 'https',
  host: 'api.netlify.com',
  pathPrefix: '/api/v1',
  globalParams: {} // parameters you want available for every request
}
```

### `client.accessToken`

A setter/getter that returns the `accessToken` that the client is configured to use.  You can set this after the class is instantiated, and all subsequent calls will use the new `accessToken`.

### `client.basePath`

A getter that returns the formatted base URL of the endpoint the client is configured to use.

### Open API Client methods

The client is dynamically generated from the [open-api](https://github.com/netlify/open-api) definition file.  Each method is is named after the `operationId` name of each endpoint action.  **To see list of available operation see the [open-api website](https://open-api.netlify.com/)**.

Every open-api method has the following signature:

#### `promise(response) = client.operationId([params], [opts])`

Perform a call to the given endpoint corresponding with the `operationId`.  Returns promise that will resolve with the body of the response, or reject with an error with details about the request attached.  Rejects if the `status` > 400.  Successful response objects have `status` and `statusText` properties on their prototype.

`params` is an object that includes any of the required or optional endpoint parameters.  `params.body` should be an object which gets serialized to JSON automatically.  If the endpoint accepts `binary`, `params.body` can be a Node.js readable stream.

```js
// example params
{
  any_param_needed,
  paramsCanAlsoBeCamelCase,
  body: {
    an: 'arbitrary js object'
  }
}
```

Optional `opts` can include any property you want passed to `node-fetch`.  The `headers` propety is merged with some `defaultHeaders`.

```js
// example opts
{
  headers
  // any other properties for node-fetch
}
```

```js
// default headers
{
  'User-agent': 'netlify-js-client',
  accept: 'application/json'
}
```

### Convenience Methods

Some methods have been added in addition to the open API methods that make certain actions simpler to perform.

#### `promise(accessToken) = client.getAccessToken(ticket, [opts])`

Pass in a [`ticket`](open-api.netlify.com#model-ticket) and get back an `accessToken`.  Call this with the response from a `client.createTicket({ client_id })` call.  Automatically sets the `accessToken` to `this.accessToken` and returns `accessToken` for the consumer to save for later.

Optional `opts` include:

```js
{
  poll: 1000, // number of ms to wait between polling
  timeout: 3.6e6 // number of ms to wait before timing out
}
```

#### `promise(deploy) = client.deploy(siteId, buildDir, [opts])`

**Node.js Only**: Pass in a `siteId` and a path to a folder you wan't to deploy.  This creates a new deploy for the `siteId`, scans the folder and begins an upload of changed files. 

Optional `opts` include:

```js
{
  deployTimeout: 1.2e6, // 20 mins
  parallelHash: 100, // number of parallel hashing calls
  parallelUpload: 4 // number of files to upload in parallel
}
```
