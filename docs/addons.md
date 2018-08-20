`netlify-cli addons`
====================

Handle addon operations
The addons command will help you manage all your netlify addons

* [`netlify-cli addons`](#netlify-cli-addons)
* [`netlify-cli addons:create NAME`](#netlify-cli-addonscreate-name)
* [`netlify-cli addons:delete NAME`](#netlify-cli-addonsdelete-name)
* [`netlify-cli addons:list`](#netlify-cli-addonslist)
* [`netlify-cli addons:update NAME`](#netlify-cli-addonsupdate-name)

## `netlify-cli addons`

Handle addon operations

```
USAGE
  $ netlify-cli addons

DESCRIPTION
  The addons command will help you manage all your netlify addons

EXAMPLES
  $ netlify addons:create addon-xyz --value foo
  $ netlify addons:update addon-xyz --value bar
  $ netlify addons:delete addon-xyz
  $ netlify addons:list
```

_See code: [src/commands/addons.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.2/src/commands/addons.js)_

## `netlify-cli addons:create NAME`

Add an addon extension to your site

```
USAGE
  $ netlify-cli addons:create NAME

ARGUMENTS
  NAME  addon namespace

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/create.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.2/src/commands/addons/create.js)_

## `netlify-cli addons:delete NAME`

Remove an addon extension to your site

```
USAGE
  $ netlify-cli addons:delete NAME

ARGUMENTS
  NAME  addon namespace

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/delete.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.2/src/commands/addons/delete.js)_

## `netlify-cli addons:list`

list current site addons

```
USAGE
  $ netlify-cli addons:list

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/list.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.2/src/commands/addons/list.js)_

## `netlify-cli addons:update NAME`

Update an addon extension

```
USAGE
  $ netlify-cli addons:update NAME

ARGUMENTS
  NAME  addon namespace

DESCRIPTION
  ...
  Addons are a way to extend the functionality of your Netlify site
```

_See code: [src/commands/addons/update.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.2/src/commands/addons/update.js)_
