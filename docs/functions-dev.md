---
title: Developing functions with Netlify CLI
---

# Serving functions locally

With the `netlify dev` command you can simulate the Netlify production environment.
`netlify dev` starts a framework server if it detects one, handles redirects, proxy rules, functions and addons.

However, when developing functions locally, it can be useful to simulate Netlify Functions in a standalone server.
That allows easier debugging and doesn't have the overhead of starting a framework server.

## Usage

- Install the latest `npm install -g netlify-cli`.
- Run `netlify functions:serve` to start the functions server.

Your function will be available at `http://localhost:9999/.netlify/functions/<function-name>`

By default the server serves functions from the configured functions directory, or `netlify/functions` if a functions directory is not configured. The default port for the functions server is `9999`.
To override these settings you can use the `--functions` and `--port` flags:

```sh
netlify functions:serve --functions <path-to-dir> --port <port>
```

or by configuring them via the `netlify.toml` dev block:

```toml
[dev]
functions = "netlify-functions"
functionsPort = 7000
```
