---
title: Netlify CLI capabilities command
sidebar:
  label: capabilities
---

# `capabilities`

The `capabilities` command prints a machine-readable JSON manifest describing the CLI itself: every command and its flags, which commands support `--json`, the exit-code dictionary, relevant environment variables, and config file locations. It is intended for scripts and AI agents that need to discover the CLI's surface without scraping `--help` output.

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Print a machine-readable manifest of every command, its flags, exit codes, env vars, and config files
Intended for scripts and AI agents. Output is always JSON on stdout.

**Usage**

```bash
netlify capabilities
```

**Flags**

- `json` (*boolean*) - Output capabilities as JSON (the default; this command always outputs JSON)
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

**Examples**

```bash
netlify capabilities
netlify capabilities --json
```


<!-- AUTO-GENERATED-CONTENT:END -->
