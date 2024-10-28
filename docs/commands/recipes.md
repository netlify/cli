---
title: Netlify CLI recipes command
---

# `recipes`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Create and modify files in a project using pre-defined recipes

**Usage**

```bash
netlify recipes
```

**Arguments**

- name - name of the recipe

**Flags**

- `name` (*string*) - recipe name to use
- `debug` (*boolean*) - Print debugging information
- `force` (*boolean*) - Force command to run. Bypasses prompts for certain destructive commands.

| Subcommand | description  |
|:--------------------------- |:-----|
| [`recipes:list`](/commands/recipes#recipeslist) | List the recipes available to create and modify files in a project  |


**Examples**

```bash
netlify recipes my-recipe
netlify recipes --name my-recipe
```

---
## `recipes:list`

List the recipes available to create and modify files in a project

**Usage**

```bash
netlify recipes:list
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `force` (*boolean*) - Force command to run. Bypasses prompts for certain destructive commands.

**Examples**

```bash
netlify recipes:list
```

---

<!-- AUTO-GENERATED-CONTENT:END -->
