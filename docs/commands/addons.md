---
title: Netlify CLI addons command
---

# `addons`

The addons command will manage Netlify addons.

For more information on add-ons see our [Netlify partner add-ons docs](https://www.netlify.com/docs/partner-add-ons/)

## About

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->

(Beta) Manage Netlify Add-ons

**Usage**

```bash
netlify addons
```

| Subcommand                                               | description                               |
| :------------------------------------------------------- | :---------------------------------------- |
| [`addons:auth`](/docs/commands/addons.md#addonsauth)     | Login to add-on provider                  |
| [`addons:config`](/docs/commands/addons.md#addonsconfig) | Configure add-on settings                 |
| [`addons:create`](/docs/commands/addons.md#addonscreate) | Add an add-on extension to your site      |
| [`addons:delete`](/docs/commands/addons.md#addonsdelete) | Remove an add-on extension to your site   |
| [`addons:list`](/docs/commands/addons.md#addonslist)     | List currently installed add-ons for site |

**Examples**

```bash
netlify addons:create addon-xyz
netlify addons:list
netlify addons:config addon-xyz
netlify addons:delete addon-xyz
netlify addons:auth addon-xyz
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

**Flags**

- `force` (_boolean_) - delete without prompting (useful for CI)

---

## `addons:list`

List currently installed add-ons for site

**Usage**

```bash
netlify addons:list
```

**Flags**

- `json` (_boolean_) - Output add-on data as JSON

---

<!-- AUTO-GENERATED-CONTENT:END -->
