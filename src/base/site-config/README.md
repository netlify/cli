# site-config

> Easily load and persist netlify site config close to where it should probably live

Config is stored in `.netlify/config.json` next to the closest `.netlify` folder, `netlify.toml` file, or `.git` folder it finds at or above the `projectDir` argument (e.g. `process.cwd`).

## Usage

```js
const SiteConfig = require('../util/site-config');

// create a Configstore instance with an unique ID e.g.
// Package name and optionally some default values
const conf = new SiteConfig(process.cwd());

console.log(conf.get('foo'));
//=> 'bar'

conf.set('awesome', true);
console.log(conf.get('awesome'));
//=> true

// Use dot-notation to access nested properties
conf.set('bar.baz', true);
console.log(conf.get('bar'));
//=> {baz: true}

conf.delete('awesome');
console.log(conf.get('awesome'));
//=> undefined
```


## API

### `SiteConfig(projectDir, [options])`

Returns a new instance.

#### projectDir

Type: `string`

A path to the project you want configuration for. e.g. `process.cwd()`

#### options

##### rootIndicators

Type:  `string` array<br>
Default: `['.netlify', 'netlify.toml', '.git']`

An array of file names that indicate a project root, when looking to find a location for the `.netlify/config.json` to be saved.

### Instance

You can use [dot-notation](https://github.com/sindresorhus/dot-prop) in a `key` to access nested properties.

### `.set(key, value)`

Set an item.

### `.set(object)`

Set multiple items at once.

### `.get(key)`

Get an item.

### `.has(key)`

Check if an item exists.

### `.delete(key)`

Delete an item.

### `.clear()`

Delete all items.

### `.size`

Get the item count.

### `.path`

Get the path to the config file. Can be used to show the user where the config file is located or even better open it for them.

### `.all`

Get all the config as an object or replace the current config with an object:

```js
conf.all = {
	hello: 'world'
};
```
