const debug = require('debug')('wait-port');
const net = require('net');
const outputFunctions = require('./output-functions');
const validateParameters = require('./validate-parameters');
const ConnectionError = require('./errors/connection-error');

function createConnectionWithTimeout({ host, port }, timeout, callback) {
  //  Variable to hold the timer we'll use to kill the socket if we don't
  //  connect in time.
  let timer = null;

  //  Try and open the socket, with the params and callback.
  const socket = net.createConnection({ host, port }, (err) => {
    if (!err) clearTimeout(timer);
    return callback(err);
  });

  //  TODO: Check for the socket ECONNREFUSED event.
  socket.on('error', (error) => {
    debug(`Socket error: ${error}`);
    clearTimeout(timer);
    socket.destroy();
    callback(error);
  });

  //  Kill the socket if we don't open in time.
  timer = setTimeout(() => {
    socket.destroy();
    const error = new Error(`Timeout trying to open socket to ${host}:${port}`);
    error.code = 'ECONNTIMEOUT';
    callback(error);
  }, timeout);

  //  Return the socket.
  return socket;
}

function checkHttp(socket, params, timeout, callback) {
  //  Create the HTTP request.
  const request = `GET ${params.path} HTTP/1.1\r\nHost: ${params.host}\r\n\r\n`;

  let timer = null;
  timer = setTimeout(() => {
    socket.destroy();
    const error = new Error(`Timeout waiting for data from ${params.host}:${params.port}`);
    error.code = 'EREQTIMEOUT';
    callback(error);
  }, timeout);

  //  Get ready for a response.
  socket.on('data', function(data) {
    //  Get the response as text.
    const response = data.toString();
    const statusLine = response.split('\n')[0];

    //  Stop the timer.
    clearTimeout(timer);

    //  Check the data. Remember an HTTP response is:
    //  HTTP/1.1 XXX Stuff
    const statusLineParts = statusLine.split(' ');
    if (statusLineParts < 2 || statusLineParts[1].startsWith('2') === false) {
      debug(`Invalid HTTP status line: ${statusLine}`);
      const error = new Error('Invalid response from server');
      error.code = 'ERESPONSE';
      callback(error);
    }

    //  ALL good!
    debug(`Successful HTTP status line: ${statusLine}`);
    callback();
  });

  //  Send the request.
  socket.write(request);
}

//  This function attempts to open a connection, given a limited time window.
//  This is the function which we will run repeatedly until we connect.
function tryConnect(options, timeout) {
  return new Promise((resolve, reject) => {
    try {
      const socket = createConnectionWithTimeout(options, timeout, (err) => {
        if (err) {
          if (err.code === 'ECONNREFUSED') {
            //  We successfully *tried* to connect, so resolve with false so
            //  that we try again.
            debug('Socket not open: ECONNREFUSED');
            socket.destroy();
            return resolve(false);
          } else if (err.code === 'ECONNTIMEOUT') {
            //  We've successfully *tried* to connect, but we're timing out
            //  establishing the connection. This is not ideal (either
            //  the port is open or it ain't).
            debug('Socket not open: ECONNTIMEOUT');
            socket.destroy();
            return resolve(false);
          } else if (err.code === 'ECONNRESET') {
            //  This can happen if the target server kills its connection before
            //  we can read from it, we can normally just try again.
            debug('Socket not open: ECONNRESET');
            socket.destroy();
            return resolve(false);
          } else if (err.code === 'ENOTFOUND') {
            //  This will occur if the address is not found, i.e. due to a dns
            //  lookup fail (normally a problem if the domain is wrong).
            debug('Socket cannot be opened: ENOTFOUND');
            socket.destroy();

            //  If we are going to wait for DNS records, we can actually just try
            //  again...
            if (options.waitForDns === true) return resolve(false);

            // ...otherwise, we will explicitly fail with a meaningful error for
            //  the user.
            return reject(new ConnectionError(`The address '${options.host}' cannot be found`));
          }

          //  Trying to open the socket has resulted in an error we don't
          //  understand. Better give up.
          debug(`Unexpected error trying to open socket: ${err}`);
          socket.destroy();
          return reject(err);
        }

        //  Boom, we connected!
        debug('Socket connected!');

        //  If we are not dealing with http, we're done.
        if (options.protocol !== 'http') {
          //  Disconnect, stop the timer and resolve.
          socket.destroy();
          return resolve(true);
        }

        //  TODO: we should only use the portion of the timeout for this interval which is still left to us.

        //  Now we've got to wait for a HTTP response.
        checkHttp(socket, options, timeout, (err) => {
          if (err) {
            if (err.code === 'EREQTIMEOUT') {
              debug('HTTP error: EREQTIMEOUT');
              socket.destroy();
              return resolve(false);
            } else if (err.code === 'ERESPONSE') {
              debug('HTTP error: ERESPONSE');
              socket.destroy();
              return resolve(false);
            }
            debug(`Unexpected error checking http response: ${err}`);
            socket.destroy();
            return reject(err);
          }

          socket.destroy();
          return resolve(true);
        });
      });
    } catch (err) {
      //  Trying to open the socket has resulted in an exception we don't
      //  understand. Better give up.
      debug(`Unexpected exception trying to open socket: ${err}`);
      return reject(err);
    }
  });
}

function waitPort(params) {
  return new Promise((resolve, reject) => {
    const {
      protocol,
      host,
      port,
      path,
      interval,
      timeout,
      output,
      waitForDns,
    } = validateParameters(params);

    //  Keep track of the start time (needed for timeout calcs).
    const startTime = new Date();

    //  Don't wait for more than connectTimeout to try and connect.
    const connectTimeout = 1000;

    //  Grab the object for output.
    const outputFunction = outputFunctions[output];
    outputFunction.starting({ host, port });

    //  Start trying to connect.
    const loop = () => {
      outputFunction.tryConnect();
      tryConnect({ protocol, host, port, path, waitForDns }, connectTimeout)
        .then((open) => {
          debug(`Socket status is: ${open}`);

          //  The socket is open, we're done.
          if (open) {
            outputFunction.connected();
            return resolve(true);
          }

          //  If we have a timeout, and we've passed it, we're done.
          if (timeout && (new Date() - startTime) > timeout) {
            outputFunction.timeout();
            return resolve(false);
          }

          //  Run the loop again.
          return setTimeout(loop, interval);
        })
        .catch((err) => {
          debug(`Unhandled error occured trying to connect: ${err}`);
          return reject(err);
        });
    };

    //  Start the loop.
    loop();
  });
}

module.exports = waitPort;
