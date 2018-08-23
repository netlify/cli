`netlify addons`
================

Handle addon operations
The addons command will help you manage all your netlify addons

* [`netlify addons`](#netlify-addons)
* [`netlify addons:create NAME`](#netlify-addonscreate-name)
* [`netlify addons:delete NAME`](#netlify-addonsdelete-name)
* [`netlify addons:list`](#netlify-addonslist)
* [`netlify addons:update NAME`](#netlify-addonsupdate-name)

## `netlify addons`

Handle addon operations

```
USAGE
  $ netlify addons

DESCRIPTION
  The addons command will help you manage all your netlify addons

EXAMPLES
  $ netlify addons:create addon-xyz --value foo
  $ netlify addons:update addon-xyz --value bar
  $ netlify addons:delete addon-xyz
  $ netlify addons:list
```

_See code: [src/commands/addons.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/addons.js)_

## `netlify addons:create NAME`

Add an addon extension to your site

```
USAGE
  $ netlify addons:create NAME

ARGUMENTS
  NAME  addon namespace

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/create.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/addons/create.js)_

## `netlify addons:delete NAME`

Remove an addon extension to your site

```
USAGE
  $ netlify addons:delete NAME

ARGUMENTS
  NAME  addon namespace

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/delete.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/addons/delete.js)_

## `netlify addons:list`

list current site addons

```
USAGE
  $ netlify addons:list

OPTIONS
  --json

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/list.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/addons/list.js)_

## `netlify addons:update NAME`

Update an addon extension

```
USAGE
  $ netlify addons:update NAME

ARGUMENTS
  NAME  addon namespace

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/update.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/addons/update.js)_
