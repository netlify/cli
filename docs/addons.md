---
title: Netlify CLI addons command
hidden: true
---

# `addons`

The addons command will help you manage all your netlify addons

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Handle addon operations
The addons command will help you manage all your netlify addons


**Usage**

```bash
netlify addons
```

| Subcommand | description  |
|:--------------------------- |:-----|
| [`addons:auth`](/addons#addonsauth) | Login to add-on provider  |
| [`addons:config`](/addons#addonsconfig) | Configure add-on settings  |
| [`addons:create`](/addons#addonscreate) | Add an add-on extension to your site  |
| [`addons:delete`](/addons#addonsdelete) | Remove an add-on extension to your site  |
| [`addons:list`](/addons#addonslist) | list current site add-ons  |


**Examples**

```bash
netlify addons:create addon-xyz --value foo
netlify addons:update addon-xyz --value bar
netlify addons:show addon-xyz
netlify addons:delete addon-xyz
netlify addons:list
```

---
## `addons:auth`

Login to add-on provider

**Usage**

```bash
netlify addons:auth
```

**Arguments**

- name - Add-on slug

---
## `addons:config`

Configure add-on settings

**Usage**

```bash
netlify addons:config
```

**Arguments**

- name - Add-on namespace

---
## `addons:create`

Add an add-on extension to your site
...
Add-ons are a way to extend the functionality of your Netlify site


**Usage**

```bash
netlify addons:create
```

**Arguments**

- name - Add-on namespace

---
## `addons:delete`

Remove an add-on extension to your site
...
Add-ons are a way to extend the functionality of your Netlify site


**Usage**

```bash
netlify addons:delete
```

**Arguments**

- name - Add-on namespace

---
## `addons:list`

list current site add-ons
...
Add-ons are a way to extend the functionality of your Netlify site


**Usage**

```bash
netlify addons:list
```

**Flags**

- `json` (*boolean*) - Output add-on data as JSON

---

<!-- AUTO-GENERATED-CONTENT:END -->
