const assert = require('assert');
const net = require('net');
const sinon = require('sinon');
const waitPort = require('../wait-port');

describe('dots output function', () => {

  it('should show a dot or two if the dots output is specified', () => {

    const server = net.createServer();
    server.listen(9021, '127.0.0.1');

    //  Spy on stdout.
    const stdout = sinon.stub(process.stdout, 'write');

    return waitPort({ host: '127.0.0.1', port: 9021, output: 'dots' })
      .then(() => {
        assert(stdout.called, 'stdout should have dots written.');
        stdout.restore();
        server.close();
      });
  });
  
  it('should show a timeout message if there is a timeout', () => {

    //  Spy on stdout.
    const log = sinon.stub(console, 'log');

    return waitPort({ host: '127.0.0.1', port: 9021, timeout: 1, output: 'dots' })
      .then(() => {
        assert(log.calledWithMatch(/[T|t]imeout/));
        log.restore();
      });
  });
});
