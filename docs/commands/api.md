---
title: Netlify CLI api command
sidebar:
  label: api
---

# `api`

The `api` command will let you call any [Netlify open API methods](https://open-api.netlify.com/)

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Run any Netlify API method
For more information on available methods check out https://open-api.netlify.com/ or run 'netlify api --list'

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
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify api --list
netlify api getSite --data '{ "site_id": "123456" }'
```


<!-- AUTO-GENERATED-CONTENT:END -->
