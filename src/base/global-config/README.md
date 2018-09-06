# `global-config.js`

## Usage

```js
const global = require('../util/global-config')
global.get('userId')
global.get('foo', 'bar')
```

## API

`global-config.js` is an instantiated proxy wrapped [configstore](https://github.com/yeoman/configstore), and has all of the same methods as that module.  See the docs there for a general overview.

The configuration file is stored in `~/.netlify/config.json`.

- `.set(key, value)`
- `.set(object)`
- `.get(key)`
- `.has(key)`
- `.delete(key)`
- `.clear()`
- `.size()`
- `.path`
- `.all`

What is special about our proxy wrapper is that it allows you to override any global configuration valye with a `SNAKE_CASE` ENV var that is prefixed with `NETLIFY_`.
