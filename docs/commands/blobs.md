---
title: Netlify CLI blobs command
sidebar:
  label: blobs
description: Manage objects in Netlify Blobs
---

# `blobs`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
Manage objects in Netlify Blobs

**Usage**

```bash
netlify blobs
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

| Subcommand | description  |
|:--------------------------- |:-----|
| [`blobs:delete`](/commands/blobs#blobsdelete) | Deletes an object with a given key, if it exists, from a Netlify Blobs store  |
| [`blobs:get`](/commands/blobs#blobsget) | Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file  |
| [`blobs:list`](/commands/blobs#blobslist) | Lists objects in a Netlify Blobs store  |
| [`blobs:set`](/commands/blobs#blobsset) | Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter  |


**Examples**

```bash
netlify blobs:get my-store my-key
netlify blobs:set my-store my-key This will go in a blob
netlify blobs:set my-store my-key --input ./some-file.txt
netlify blobs:delete my-store my-key
netlify blobs:list my-store
netlify blobs:list my-store --json
```

---
## `blobs:delete`

Deletes an object with a given key, if it exists, from a Netlify Blobs store

**Usage**

```bash
netlify blobs:delete
```

**Arguments**

- store - Name of the store
- key - Object key

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Bypasses prompts & Force the command to run.
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `blobs:get`

Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file

**Usage**

```bash
netlify blobs:get
```

**Arguments**

- store - Name of the store
- key - Object key

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `output` (*string*) - Defines the filesystem path where the blob data should be persisted
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `blobs:list`

Lists objects in a Netlify Blobs store

**Usage**

```bash
netlify blobs:list
```

**Arguments**

- store - Name of the store

**Flags**

- `directories` (*boolean*) - Indicates that keys with the '/' character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them
- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `json` (*boolean*) - Output list contents as JSON
- `prefix` (*string*) - A string for filtering down the entries; when specified, only the entries whose key starts with that prefix are returned
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---
## `blobs:set`

Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter

**Usage**

```bash
netlify blobs:set
```

**Arguments**

- store - Name of the store
- key - Object key
- value - Object value

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `force` (*boolean*) - Bypasses prompts & Force the command to run.
- `input` (*string*) - Defines the filesystem path where the blob data should be read from
- `debug` (*boolean*) - Print debugging information
- `auth` (*string*) - Netlify auth token - can be used to run this command without logging in

---

<!-- AUTO-GENERATED-CONTENT:END -->
