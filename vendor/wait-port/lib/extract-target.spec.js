const assert = require('assert');
const extractTarget = require('./extract-target');
const TargetError = require('./errors/target-error');

//  Note: from Node 10 onwards we can use the much cleaner format:
//    assert.throws(() => extractTarget('808X'), {
//      name: 'TargetError',
//      message: /808X.*port.*number/,
//    });
//  however, Node 8 won't use a regex in 'messagae'.


describe('extractTarget', () => {
  it('should throw if no target is provided', () => {
    assert.throws(() => extractTarget(), TargetError);
    assert.throws(() => extractTarget(), /target/);
  });

  it('should throw if more than one separator is used', () => {
    assert.throws(() => extractTarget('host:port:wtf'), TargetError);
    assert.throws(() => extractTarget('host:port:wtf'), /invalid.*:/);
  });

  it('should throw if a non-numeric port target is provided', () => {
    assert.throws(() => extractTarget('808X'), TargetError);
    assert.throws(() => extractTarget('808X'), /808X.*port.*number/);
  });

  it('should throw if a non-numeric :port target is provided', () => {
    assert.throws(() => extractTarget(':808X'), TargetError);
    assert.throws(() => extractTarget(':808X'), /808X.*port.*number/);
  });

  it('should throw if a non-numeric host:port target is provided', () => {
    assert.throws(() => extractTarget('host:808X'), TargetError);
    assert.throws(() => extractTarget('host:808X'), /808X.*port.*number/);
  });

  it('should extract a valid port', () => {
    const { port, host } = extractTarget('8080');
    assert.strictEqual(port, 8080);
    assert.strictEqual(host, undefined);
  });

  it('should extract a valid :port', () => {
    const { port, host } = extractTarget(':8080');
    assert.strictEqual(port, 8080);
    assert.strictEqual(host, undefined);
  });

  it('should extract a valid host:port', () => {
    const { port, host } = extractTarget('127.0.0.1:8080');
    assert.strictEqual(port, 8080);
    assert.strictEqual(host, '127.0.0.1');
  });

  it('should extract a valid protocol', () => {
    const { protocol, port, host, path } = extractTarget('http://:9000');
    assert.strictEqual(protocol, 'http');
    assert.strictEqual(port, 9000);
    assert.strictEqual(host, undefined);
    assert.strictEqual(path, undefined);
  });

  it('should extract a valid protocol and path', () => {
    const { protocol, port, host, path } = extractTarget('http://google:9000/healthcheck');
    assert.strictEqual(protocol, 'http');
    assert.strictEqual(port, 9000);
    assert.strictEqual(host, 'google');
    assert.strictEqual(path, '/healthcheck');
  });
});
