---
title: Netlify CLI api command
---

# `api`

The `api` command will let you call any [Netlify open API methods](https://open-api.netlify.com/)

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Run any Netlify API method
For more information on available methods checkout https://open-api.netlify.com/ or run 'netlify api --list'

**Usage**

```bash
netlify api
```

**Arguments**

- apiMethod - Open API method to run

**Flags**

- `data` (*string*) - Data to use
- `debug` (*boolean*) - Print debugging information
- `http-proxy` (*string*) - Proxy server address to route requests through.
- `http-proxy-certificate-filename` (*string*) - Certificate file to use when connecting using a proxy server
- `list` (*boolean*) - List out available API methods

**Examples**

```bash
netlify api --list
netlify api getSite --data '{ "site_id": "123456" }'
```


<!-- AUTO-GENERATED-CONTENT:END -->
