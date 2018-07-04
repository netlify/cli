`netlify-cli functions`
=======================

Manage netlify functions
The [92m`functions`[39m command will help you manage the functions in this site

* [`netlify-cli functions`](#netlify-cli-functions)
* [`netlify-cli functions:build`](#netlify-cli-functionsbuild)
* [`netlify-cli functions:create`](#netlify-cli-functionscreate)
* [`netlify-cli functions:list`](#netlify-cli-functionslist)
* [`netlify-cli functions:serve`](#netlify-cli-functionsserve)
* [`netlify-cli functions:update`](#netlify-cli-functionsupdate)

## `netlify-cli functions`

Manage netlify functions

```
USAGE
  $ netlify-cli functions

DESCRIPTION
  The `functions` command will help you manage the functions in this site

EXAMPLES
  $ netlify functions:create --name function-xyz --runtime nodejs
  $ netlify functions:update --name function-abc --timeout 30s
```

_See code: [dist/commands/functions/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/functions/index.js)_

## `netlify-cli functions:build`

build functions locally

```
USAGE
  $ netlify-cli functions:build

OPTIONS
  -n, --name=name  name to print
```

_See code: [dist/commands/functions/build/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/functions/build/index.js)_

## `netlify-cli functions:create`

create a new function locally

```
USAGE
  $ netlify-cli functions:create

OPTIONS
  -n, --name=name  name to print
```

_See code: [dist/commands/functions/create/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/functions/create/index.js)_

## `netlify-cli functions:list`

list sites

```
USAGE
  $ netlify-cli functions:list

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [dist/commands/functions/list/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/functions/list/index.js)_

## `netlify-cli functions:serve`

serve functions locally for dev

```
USAGE
  $ netlify-cli functions:serve

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [dist/commands/functions/serve/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/functions/serve/index.js)_

## `netlify-cli functions:update`

update a function

```
USAGE
  $ netlify-cli functions:update

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [dist/commands/functions/update/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/functions/update/index.js)_
