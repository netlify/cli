const assert = require('assert');
const http = require('http');
const net = require('net');
const waitPort = require('./wait-port');

describe('wait-port', () => {

  it('should wait until a port is open', () => {

    const server = net.createServer();
    server.listen(9021, '127.0.0.1');

    //  Start waiting for port 9021 to open. If it opens we pass, otherwise we
    //  fail.
    return waitPort({ host: '127.0.0.1', port: 9021, output: 'silent' })
      .then((open) => {
        server.close();
        assert(open === true, 'Waiting for the port should find it to open.');
      });
  });

  it('should timeout after the specified time', () => {
    const timeout = 5000;
    const delta = 500;

    //  Start waiting for port 9021 to open.
    const start = new Date();
    return waitPort({ host: '127.0.0.1', port: 9021, timeout, output: 'silent' })
      .then((open) => {
        assert(open === false, 'The port should not be open.');
        
        //  Make sure we are close to the timeout.
        const elapsed = new Date() - start;
        assert(((timeout - delta) < elapsed) && (elapsed < (timeout + delta)),
          `Timeout took ${elapsed}ms, should be close to ${timeout}ms.`);
      });
  });
  
  it('should timeout after the specified time even with a non-routable address', () => {
    return waitPort({ host: '10.255.255.1', port: 9021, timeout: 500, output: 'silent' })
      .then((open) => {
        assert(open === false, 'The port should not be open.');
      });
  });

  it('should timeout after the specified time when waiting for http but only given tcp/ip', () => {
    //  We can create a TCP/IP server, but this should not be enough, cause we're waiting for http.
    const server = net.createServer();
    server.listen(9021, '127.0.0.1');

    return waitPort({ protocol: 'http', host: '127.0.0.1', port: 9021, timeout: 500, output: 'silent' })
      .then((open) => {
        server.close();
        assert(open === false, 'The port should not be open for http.');
      });
  });

  it('should timeout when waiting for an http server which is giving non-2XX responses', () => {
    const server = http.createServer((req, res) => {
      res.writeHead(400);
      res.write('Bad input');
      res.end();
    }).listen(9022);

    return waitPort({ protocol: 'http', host: '127.0.0.1', port: 9022, timeout: 3000, output: 'silent' })
      .then((open) => {
        server.close();
        assert(open === false, 'The success condition should not be met');
      });
  });

  it('should error if the address is not found', () => {

    //  Wait for a point on an address (I hope) does not exist.
    return waitPort({ host: 'ireallyhopethatthisdomainnamedoesnotexist.com', port: 9021, timeout: 3000, output: 'silent' })
      .then(() => {
        assert.fail('The operation should throw, rather than completing.');
      })
      .catch((err) => {
        assert.strictEqual(err.name, 'ConnectionError', 'A ConnectionFailed error should be thrown');
        assert(/.*address.*ireallyhopethatthisdomainnamedoesnotexist.com/.test(err.message));
      });
  });

  it('should not error if the address is not found when the \'wait-for-dns\' flag is used', () => {

    const timeout = 1000;
    const delta = 500;

    //  Start waiting for port 9021 to open.
    const start = new Date();
    return waitPort({ host: 'ireallyhopethatthisdomainnamedoesnotexist.com', waitForDns: true, port: 9021, timeout, output: 'silent' })
      .then((open) => {
        assert(open === false, 'The port should not be open.');
        
        //  Make sure we are close to the timeout.
        const elapsed = new Date() - start;
        assert(((timeout - delta) < elapsed) && (elapsed < (timeout + delta)),
          `Timeout took ${elapsed}ms, should be close to ${timeout}ms.`);
      });
  });
  
  
  it('should successfully wait for a valid http response', () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200);
      res.write('OK');
      res.end();
    }).listen(9023);

    return waitPort({ protocol: 'http', host: '127.0.0.1', port: 9023, timeout: 3000, output: 'silent' })
      .then((open) => {
        server.close();
        assert(open === true, 'The success condition should be met');
      });
  });
});
