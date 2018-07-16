import fs from 'fs'
import { serial as test } from 'ava'
import SiteConfig from '.'

test.beforeEach(t => {
  fs.unlinkSync(configstorePath)
  t.context.conf = new Configstore('configstore-test')
})

test('.set() and .get()', t => {
  const { conf } = t.context
  conf.set('foo', 'bar')
  conf.set('baz.boo', true)
  t.is(conf.get('foo'), 'bar')
  t.is(conf.get('baz.boo'), true)
})

test('.set() with object and .get()', t => {
  const { conf } = t.context
  conf.set({
    foo1: 'bar1',
    foo2: 'bar2',
    baz: {
      boo: 'foo',
      foo: {
        bar: 'baz'
      }
    }
  })
  t.is(conf.get('foo1'), 'bar1')
  t.is(conf.get('foo2'), 'bar2')
  t.deepEqual(conf.get('baz'), {
    boo: 'foo',
    foo: {
      bar: 'baz'
    }
  })
  t.is(conf.get('baz.boo'), 'foo')
  t.deepEqual(conf.get('baz.foo'), { bar: 'baz' })
  t.is(conf.get('baz.foo.bar'), 'baz')
})

test('.has()', t => {
  const { conf } = t.context
  conf.set('foo', '🦄')
  conf.set('baz.boo', '🦄')
  t.true(conf.has('foo'))
  t.true(conf.has('baz.boo'))
  t.false(conf.has('missing'))
})

test('.delete()', t => {
  const { conf } = t.context
  conf.set('foo', 'bar')
  conf.set('baz.boo', true)
  conf.set('baz.foo.bar', 'baz')
  conf.delete('foo')
  t.not(conf.get('foo'), 'bar')
  conf.delete('baz.boo')
  t.not(conf.get('baz.boo'), true)
  conf.delete('baz.foo')
  t.not(conf.get('baz.foo'), { bar: 'baz' })
  conf.set('foo.bar.baz', { awesome: 'icecream' })
  conf.set('foo.bar.zoo', { awesome: 'redpanda' })
  conf.delete('foo.bar.baz')
  t.is(conf.get('foo.bar.zoo.awesome'), 'redpanda')
})

test('.clear()', t => {
  const { conf } = t.context
  conf.set('foo', 'bar')
  conf.set('foo1', 'bar1')
  conf.set('baz.boo', true)
  conf.clear()
  t.is(conf.size, 0)
})

test('.all', t => {
  const { conf } = t.context
  conf.set('foo', 'bar')
  conf.set('baz.boo', true)
  t.is(conf.all.foo, 'bar')
  t.deepEqual(conf.all.baz, { boo: true })
})

test('.size', t => {
  const { conf } = t.context
  conf.set('foo', 'bar')
  t.is(conf.size, 1)
})

test('.path', t => {
  const { conf } = t.context
  conf.set('foo', 'bar')
  t.true(fs.existsSync(conf.path))
})

test('use default value', t => {
  const conf = new Configstore('configstore-test', { foo: 'bar' })
  t.is(conf.get('foo'), 'bar')
})

test('support global namespace path option', t => {
  const conf = new Configstore('configstore-test', {}, { globalConfigPath: true })
  const regex = /configstore-test(\/|\\)config.json$/
  t.true(regex.test(conf.path))
})

test('ensure `.all` is always an object', t => {
  fs.unlinkSync(configstorePath)
  t.notThrows(() => t.context.conf.get('foo'))
})
