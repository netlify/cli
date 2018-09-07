# netlify-cli [beta]
[![npm version][2]][3] [![build status][4]][5] [![windows build status][6]][7]
[![coverage][12]][13] [![dependencies][14]][15] [![downloads][8]][9]

Welcome to the Netlify CLI! The new 2.0 version (now in beta) was rebuilt from the ground up to help improve the site building experience.

## Table of Contents

<!-- AUTO-GENERATED-CONTENT:START (TOC:collapse=true&collapseText=Click to expand) -->
<details>
<summary>Click to expand</summary>

- [Install & Setup](#install--setup)
- [Usage](#usage)
- [Commands](#commands)
  * [deploy](#deploy)
  * [init](#init)
  * [link](#link)
  * [login](#login)
  * [logout](#logout)
  * [open](#open)
  * [sites](#sites)
  * [status](#status)
  * [unlink](#unlink)
  * [watch](#watch)
- [Local Development](#local-development)

</details>
<!-- AUTO-GENERATED-CONTENT:END -->

## Installation

To install Netlify CLI, you must first download and install [Node.js](https://nodejs.org/en/download/) on your computer. After that, open your terminal and run the following command from any directory:

```bash
npm install netlify-cli -g
```

This will install Netlify CLI globally, so you can run `netlify` commands from any directory. You can check the version and find out some basic information about the tool with the following command:

```bash
netlify
```

## Authentication

Netlify CLI uses an access token to authenticate with Netlify. You can obtain this token via the command line or in the Netlify UI.

### Command-line Login

To authenticate and obtain an access token via the command line, enter the following command:

```bash
netlify login
```

This will open a browser window, asking you to log in with Netlify and grant access to **Netlify Cli**.

![](/img/docs/cli/authorize-ui.png)

Once authorized, Netlify CLI will store your access token in your home folder, under `.netlify/config.json`. Netlify CLI will use the token in this location automatically for all future commands.

You can also log out using Netlify CLI, with the following command:

```bash
netlify logout
```

This will remove the access key from the `.netlify/config.json` file in your home folder.

### Obtain a Token in the Netlify UI

You can generate an access token manually in your Netlify account settings under [**OAuth applications**](https://app.netlify.com/applications). 

1. Under **Personal access tokens**, select **New access token**.
2. Enter a description and select **Generate token**.
3. Copy the generated token to your clipboard. Once you navigate from the page, the token cannot be seen again.
4. On the computer where you want to run Netlify CLI, create a `.netlify` folder inside the home folder, and a `config.json` file inside of that.
5. Add the following line to the `config.json` file:

   ```json
   {
   "accessToken": "PASTE_YOUR_ACCESS_TOKEN_HERE"
   }
   ```

Netlify CLI will use the access token in that location automatically.

### Revoking Access

To revoke access to your account for Netlify CLI, go to the [**OAuth applications**](https://app.netlify.com/applications) section of your account settings. Find the appropriate token or application, and select **Revoke**.

## Continuous Deployment

With [continuous deployment](/docs/continuous-deployment), Netlify will automatically deploy new versions of your site when you push commits to your connected Git repository. This also enables features like Deploy Previews, branch deploys, and [split testing](/docs/split-testing). (Some of these features must be enabled in the Netlify UI.)

### Automated Setup

For repositories stored on GitHub, you can use Netlify CLI to connect your repository by running the following command from your local repository:

```bash
netlify init
```

In order to connect your repository for continuous deployment, Netlify CLI will need access to create a deploy key and a webhook on the repository. When you run the command above, you'll be prompted to log in to your GitHub account, which will create an account-level access token.

The access token will be stored in your home folder, under `.netlify/config.json`. Your login password will never be stored. You can revoke the access token at any time from your GitHub account settings.

### Manual Setup

For repositories stored on other Git providers, or if you prefer to give more limited, repository-only access, you can connect your repository manually by adding the `--manual` flag. From your local repository, run the following command:

```bash
netlify init --manual
```

The tool will prompt you for your deploy settings, then provide you with two items you will need to add to your repository settings with your Git provider:

* **Deploy/access key:** Netlify uses this key to fetch your repository via ssh for building and deploying.
      ![Sample terminal output reads: 'Give this Netlify SSH public key access to your repository,' and displays a key code.](/img/docs/cli/deploy-key-cli.png)
  Copy the key printed in the command line, then add it as a deploy key in the repository settings on your Git Provider. The deploy key does not require write access. Note that if you have more than one site connected to a repo, you will need a unique key for each one.
* **Webhook:** Your Git provider will send a message to this webhook when you push changes to your repository, triggering a new deploy on Netlify.
      ![Sample terminal output reads: 'Configure the following webhook for your repository,' and displays a URL.](/img/docs/cli/webhook-cli.png)
  Copy the webhook address printed in the command line, then add it as the Payload URL for a new webhook in the repository settings on your Git provider. If available, the **Content type** should be set to `application/json`. When selecting events to trigger the webhook, **Push** events will trigger production and branch deploys on watched branches, and **Pull/Merge request** events will trigger deploy previews.

## Manual Deploy

It's also possible to deploy a site manually, without continuous deployment. This method uploads files directly from your local project directory to your site on Netlify, without running a build step. It also works with directories that are not Git repositories. 

A common use case for this command is when you're using a separate Contiuous Integration (CI) tool, deploying prebuilt files to Netlify at the end of the CI tool tasks.

### Create a new site

In order manually deploy, you need to connect to a site on Netlify. You can create a site by dropping a folder into the Netlify UI, or you can create one from the command line with the following command:

```bash
netlify sites:create
```

### Link to a Site

Linking to a site tells Netlify CLI which site the current directory should deploy to. To do this, run the following command from the base of your project directory:

```bash
netlify link
```

This will add a `siteId` field to a new file inside your project folder, at `.netlify/config.json`. To unlink your folder from the site, you can remove this field, or you can run the following command from inside the project folder:

```bash
netlify unlink
```

### Deploy Your Files and Functions

Once you have your project folder linked to a site on Netlify, you can deploy your files with the following command:

```bash
netlify deploy
```

This command needs to know which folder to publish, and if your project includes functions, a functions folder to deploy. It will look for this information in three places, in the following order:

* in flags specified in the command itself
* in a [netlify.toml file](/docs/netlify-toml-reference) stored at the base of your project directory.
* in your site settings in the Netlify UI.

Here is an example using command flags to set the publish folder and functions folder:

```bash
netlify deploy --publish-folder=_site --functions=functions
```

### Draft Deploys

To preview a manual deploy without changing it in production, use the `--draft` flag:

```bash
netlify deploy --draft
```

This will run a deploy just like your production deploy, but at a unique address. The draft site URL will display in the command line when the deploy is done.

## Inline Help

For a full list of commands and global flags available with Netlify CLI, run the following:

```bash
netlify help
```

For more information about a specific command, run `help` with the name of the command.

```bash
netlify help deploy
```

This also works for sub-commands.

```bash
netlify help sites:create
```

## Full Command Reference

<!-- AUTO-GENERATED-CONTENT:START (GENERATE_COMMANDS_LIST) -->
### [deploy](/docs/commands/deploy.md)

Create a new deploy from the contents of a folder

### [init](/docs/commands/init.md)

Configure continuous deployment for a new or existing site

### [link](/docs/commands/link.md)

Link a local repo or project folder to an existing site on Netlify

### [login](/docs/commands/login.md)

Login to your Netlify account

### [logout](/docs/commands/logout.md)

Logout of your Netlify account

### [open](/docs/commands/open.md)

Open settings for the site linked to the current folder

| Subcommand | description  |
|:--------------------------- |:-----|
| [`open:admin`](/docs/commands/open.md#openadmin) | Opens current site admin UI in Netlify  |
| [`open:site`](/docs/commands/open.md#opensite) | Opens current site url in browser  |


### [sites](/docs/commands/sites.md)

Handle various site operations

| Subcommand | description  |
|:--------------------------- |:-----|
| [`sites:create`](/docs/commands/sites.md#sitescreate) | Create an empty site (advanced)  |
| [`sites:list`](/docs/commands/sites.md#siteslist) | List all sites you have access too  |


### [status](/docs/commands/status.md)

Print status information

| Subcommand | description  |
|:--------------------------- |:-----|
| [`status:hooks`](/docs/commands/status.md#statushooks) | Print hook information of the linked site  |


### [unlink](/docs/commands/unlink.md)

Unlink a local folder from a Netlify site

### [watch](/docs/commands/watch.md)

Watch for site deploy to finish


<!-- AUTO-GENERATED-CONTENT:END -->

# Local Development

1. Clone down the repo

```command
$ git clone git@github.com:netlify/cli.git
```

2. Install dependencies

```command
$ npm install
```

3. Run CLI locally during development

```command
$ ./bin/run [command]
```

When developing, you can use watch mode which will automatically run ava tests:

```command
$ npm run watch
```


[0]: https://img.shields.io/badge/stability-stable-green.svg
[1]: https://nodejs.org/api/documentation.html#documentation_stability_index
[2]: https://img.shields.io/npm/v/netlify-cli.svg
[3]: https://npmjs.org/package/netlify-cli
[4]: https://img.shields.io/travis/netlify/cli/master.svg
[5]: https://travis-ci.org/netlify/cli
[6]: https://ci.appveyor.com/api/projects/status/imk2qjc34ly7x11b/branch/master?svg=true
[7]: https://ci.appveyor.com/project/netlify/cli
[8]: https://img.shields.io/npm/dm/netlify-cli.svg
[9]: https://npmjs.org/package/netlify-cli
[12]: https://img.shields.io/coveralls/netlify/cli/master.svg
[13]: https://coveralls.io/github/netlify/cli
[14]: https://david-dm.org/netlify/cli/status.svg
[15]: https://david-dm.org/netlify/cli
