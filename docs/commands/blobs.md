---
title: Netlify CLI blobs command
description: Manage objects in Netlify Blobs
---

# `blobs`

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_DOCS) -->
(Beta) Manage objects in Netlify Blobs

**Usage**

```bash
netlify blobs
```

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`blobs:delete`](/docs/commands/blobs.md#blobsdelete) | (Beta) Deletes an object with a given key, if it exists, from a Netlify Blobs store  |
| [`blobs:get`](/docs/commands/blobs.md#blobsget) | (Beta) Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file  |
| [`blobs:list`](/docs/commands/blobs.md#blobslist) | (Beta) Lists objects in a Netlify Blobs store  |
| [`blobs:set`](/docs/commands/blobs.md#blobsset) | (Beta) Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter  |


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

(Beta) Deletes an object with a given key, if it exists, from a Netlify Blobs store

**Usage**

```bash
netlify blobs:delete
```

**Arguments**

- store - Name of the store
- key - Object key

**Flags**

- `filter` (*string*) - For monorepos, specify the name of the application to run the command in
- `debug` (*boolean*) - Print debugging information

---
## `blobs:get`

(Beta) Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file

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

---
## `blobs:list`

(Beta) Lists objects in a Netlify Blobs store

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

---
## `blobs:set`

(Beta) Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter

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
- `input` (*string*) - Defines the filesystem path where the blob data should be read from
- `debug` (*boolean*) - Print debugging information

---

<!-- AUTO-GENERATED-CONTENT:END -->
