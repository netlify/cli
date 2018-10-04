---
title: Netlify CLI deploy command
---

# `deploy`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Create a new deploy from the contents of a folder

Deploys from the build settings found in the netlify.toml file, or settings from the api.


**Usage**

```bash
netlify deploy
```

**Flags**

- `dir` (*option*) - Specify a folder to deploy
- `functions` (*option*) - Specify a functions folder to deploy
- `prod` (*boolean*) - Deploy to production
- `open` (*boolean*) - Open site after deploy
- `message` (*string*) - Optional message to associate with deploy

**Examples**

```bash
netlify deploy
netlify deploy --prod
netlify deploy --prod --open
netlify deploy --message "Some String $ENV_VAR"
```


<!-- AUTO-GENERATED-CONTENT:END -->
