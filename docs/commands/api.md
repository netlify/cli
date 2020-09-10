---
title: Netlify CLI api command
---

# `api`

The `api` command will let you call any [Netlify open API methods](https://open-api.netlify.com/)

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Run any Netlify API method

For more information on available methods checkout https://open-api.netlify.com/ or run "netlify api --list"


**Usage**

```bash
netlify api
```

**Arguments**

- apiMethod - Open API method to run

**Flags**

- `data` (*string*) - Data to use
- `list` (*boolean*) - List out available API methods
- `debug` (*boolean*) - Print debugging information
- `httpProxy` (*string*) - Proxy server address to route requests through.
- `httpProxyCertificateFilename` (*string*) - Certificate file to use when connecting using a proxy server

**Examples**

```bash
netlify api --list
netlify api getSite --data '{ "site_id": "123456"}'
```


<!-- AUTO-GENERATED-CONTENT:END -->
