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

- `data` (_option_) - Data to use
- `list` (_boolean_) - List out available API methods

**Examples**

```bash
netlify api --list
netlify api getSite --data '{ "site_id": "123456"}'
```

<!-- AUTO-GENERATED-CONTENT:END -->
