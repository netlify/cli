---
title: Getting Started with the Netlify CLI
---

# Getting Started

This guide will walk you through installing and creating your first site with the CLI.

## Installation

Lets get rolling with the Netlify CLI.

1. **Install the CLI locally**

   ```bash
   npm install netlify-cli -g
   ```

**Important:** When using the CLI in a CI environment we recommend installing it locally. See more [here](https://github.com/netlify/cli#installation).

2. **Login to your Netlify Account**

   ```bash
   netlify login
   ```

   If you are new to Netlify, you can [create an account here](https://app.netlify.com/).

3. **Initialize a new site**

   Inside of your sites `cwd`, run the following CLI command:

   ```bash
   netlify init
   ```

## Link an existing site

If your site is already created inside of [Netlify](https://app.netlify.com/), you can run the `link` command to connect the CLI to your site.

```bash
netlify link
```
