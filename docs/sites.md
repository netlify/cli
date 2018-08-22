`netlify-cli sites`
===================

Handle site operations
The sites command will help you manage all your sites

* [`netlify-cli sites`](#netlify-cli-sites)
* [`netlify-cli sites:create`](#netlify-cli-sitescreate)
* [`netlify-cli sites:delete SITEID`](#netlify-cli-sitesdelete-siteid)
* [`netlify-cli sites:list`](#netlify-cli-siteslist)
* [`netlify-cli sites:update`](#netlify-cli-sitesupdate)
* [`netlify-cli sites:watch`](#netlify-cli-siteswatch)

## `netlify-cli sites`

Handle site operations

```
USAGE
  $ netlify-cli sites

DESCRIPTION
  The sites command will help you manage all your sites

EXAMPLES
  $ netlify sites:create --name my-new-site
  $ netlify sites:update --name my-new-site
  $ netlify sites:delete --name my-new-site
  $ netlify sites:list
```

_See code: [src/commands/sites/index.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/sites/index.js)_

## `netlify-cli sites:create`

create a site

```
USAGE
  $ netlify-cli sites:create

OPTIONS
  -a, --account-slug=account-slug    account slug to create the site under
  -c, --custom-domain=custom-domain  custom domain to use with the site
  -i, --session-id=session-id        session ID for later site transfers
  -n, --name=name                    name of site
  -p, --password=password            password protect the site
  -s, --force-tls                    force TLS connections

DESCRIPTION
  ...
  Create an empty site
```

_See code: [src/commands/sites/create/index.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/sites/create/index.js)_

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

_See code: [src/commands/sites/delete/index.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/sites/delete/index.js)_

## `netlify-cli sites:list`

list sites

```
USAGE
  $ netlify-cli sites:list

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/sites/list/index.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/sites/list/index.js)_

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

_See code: [src/commands/sites/update/index.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/sites/update/index.js)_

## `netlify-cli sites:watch`

Watch for site deploy to finish

```
USAGE
  $ netlify-cli sites:watch

DESCRIPTION
  ...
  Extra documentation goes here
```

_See code: [src/commands/sites/watch/index.js](https://github.com/netlify/cli/blob/v2.0.0-alpha.4/src/commands/sites/watch/index.js)_
