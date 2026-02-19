---
title: Netlify CLI open command
sidebar:
  label: open
---

# `open`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Open settings for the project linked to the current folder

**Usage**

```bash
netlify open
```

**Flags**

- `admin` (*boolean*) - Open Netlify project
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `site` (*boolean*) - Open project

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/commands/open#openadmin) | Opens current project admin UI in Netlify  |
| [`open:site`](/commands/open#opensite) | Opens current project url in browser  |


**Examples**

```bash
netlify open --site
netlify open --admin
netlify open:admin
netlify open:site
```

---
## `open:admin`

Opens current project admin UI in Netlify

**Usage**

```bash
netlify open:admin
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

**Examples**

```bash
netlify open:admin
```

---
## `open:site`

Opens current project url in browser

**Usage**

```bash
netlify open:site
```

**Flags**

- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in

**Examples**

```bash
netlify open:site
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
