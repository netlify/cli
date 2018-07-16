`netlify-cli sites`
===================

Handle site operations
The sites command will help you manage all your sites

* [`netlify-cli sites`](#netlify-cli-sites)
* [`netlify-cli sites:create`](#netlify-cli-sitescreate)
* [`netlify-cli sites:delete SITEID`](#netlify-cli-sitesdelete-siteid)
* [`netlify-cli sites:update`](#netlify-cli-sitesupdate)

## `netlify-cli sites`

Handle site operations

```
USAGE
  $ netlify-cli sites

DESCRIPTION
  The sites command will help you manage all your sites

EXAMPLES
  $ netlify sites:create -name my-new-site
  $ netlify sites:update -name my-new-site
```

_See code: [dist/commands/sites/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/sites/index.js)_

## `netlify-cli sites:create`

create a site

```
USAGE
  $ netlify-cli sites:create

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [dist/commands/sites/create/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/sites/create/index.js)_

## `netlify-cli sites:delete SITEID`

delete a site

```
USAGE
  $ netlify-cli sites:delete SITEID

ARGUMENTS
  SITEID  Site ID to delete

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here

EXAMPLE
  $ netlify site:delete 123-432621211
```

_See code: [dist/commands/sites/delete/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/sites/delete/index.js)_

## `netlify-cli sites:update`

update a site

```
USAGE
  $ netlify-cli sites:update

OPTIONS
  -n, --name=name  name to print

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [dist/commands/sites/update/index.js](https://github.com/netlify/cli/blob/v0.0.0/dist/commands/sites/update/index.js)_
