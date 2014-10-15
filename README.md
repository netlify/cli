# Netlify CLI

The Netlify CLI tools lets you create, deploy, and delete new sites straight from your terminal.

## Installation

To install the CLI tools:

```bash
npm install netlify-cli -g
```

## Usage

Deploy a front-end project that lives in `my-project` and builds to `dist` directory:

```bash
cd my-project/
netlify deploy dist
```

## Configuration and Authentication

The first time you use the netlify cli command you'll be asked to authenticate.

Your access token is stored in `~/.netlify/config`.

Netlify also stores a local `.netlify` file in the folder where you run `netlify deploy` from where the `site_id` is stored.

## Environments

You can easily setup different environments like `staging` or `production`. Just use the `-e` flag:

```bash
netlify deploy dist -e production
```

Netlify creates different sites with each their own URL for each of your environments and keeps track of them in the `.netlify` config file.
