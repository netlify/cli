## What is Netlify Dev?

<div align="center">
  <h3>Watch the introduction (24 minutes)</h3>
  <a href="https://youtu.be/RL_gtVZ_79Q?t=812">
    <img src="https://i3.ytimg.com/vi/RL_gtVZ_79Q/hqdefault.jpg" height="200" alt="link to netlify dev talk" />
  </a>
</div>

Netlify Dev brings the power of Netlify's Edge Logic layer, [serverless functions](#netlify-functions) and [add-on ecosystem](#using-add-ons) to your local machine. It runs Netlify's production routing engine in a local dev server to make all redirects, proxy rules, function routes or add-on routes available locally and injects the correct environment variables from your site environment, installed add-ons or your netlify.toml file into your build and function environment.

```
                            ┌───────────────┐
                            │   Project     │
                            │               │
                            └localhost:5000─┘
                                    │
                                    │
       ┌──────────┐                 │
       │  Addons  ├────┐            ▼
       └──────────┘    │    ┌localhost:5000─┐     ┌──────────────┐
       ┌──────────┐    └───▶│               │     │              │
       │functions ├────────▶│    Netlify    │     │   Browser    │
       └──────────┘    ┌───▶│      Dev      │     │              │
       ┌──────────┐    │    │               │     │              │
       │_redirects│────┘    └──localhost:8888───▶ localhost:8888─┘
       └──────────┘
```

With project detectors, it automatically detects common tools like Gatsby, Hugo, React Static, Eleventy, and more, to give a zero config setup for your local dev server and can help scaffolding new functions as you work on them. Read our blog post for [more on detectors and how you can contribute](https://www.netlify.com/blog/2019/04/24/zero-config-yet-technology-agnostic-how-netlify-dev-detectors-work/)!

## Prerequisites

- You should have the latest Netlify CLI version. Run `npm install -g netlify-cli` to be sure.
- You should be [logged in on Netlify CLI](https://www.netlify.com/docs/cli/#authentication)
- Your project should be linked to a `siteID` on Netlify (using [netlify init](https://www.netlify.com/docs/cli/#continuous-deployment) or [netlify link](https://www.netlify.com/docs/cli/#linking-and-unlinking-sites)). You can confirm this has been done if you have a `.netlify` folder with a `state.json` file containing your `siteID`.

This is how we pull down your build environment variables and manage your addons on your local machine.

## Usage

- `netlify dev` start a local dev server for the build tool you're using
- `netlify dev:exec <command>` runs a shell command within the netlify dev environment
- `netlify functions:create` bootstrap a new function

<details>
<summary>
<b>Pro tip: Aliasing commands</b>
</summary>

As these commands are expected to be frequently used, it may be helpful to define aliases in your terminal (Mac: [bash](https://jonsuh.com/blog/bash-command-line-shortcuts/), [zsh](https://askubuntu.com/questions/758496/how-to-make-a-permanent-alias-in-oh-my-zsh), Windows: [doskey](https://stackoverflow.com/questions/20530996/aliases-in-windows-command-prompt), [registry](https://stackoverflow.com/questions/20530996/aliases-in-windows-command-prompt)) to your personal preference. For example:

```bash
## ~/.zshrc
alias ndeploy="netlify deploy --prod"
alias nd="netlify dev"
alias ndl="netlify dev --live"
alias nfc="netlify functions:create"
alias ndx="netlify dev:exec "
```

</details>

## Netlify Dev usage

```bash
USAGE
  $ netlify dev

OPTIONS
  -c, --command=command      command to run
  -f, --functions=functions  Specify a functions folder to serve
  -o, --offline              disables any features that require network access
  -p, --port=port            Specify port of netlify dev
  -l, --live                 Start a public live session

DESCRIPTION
  The dev command will run a local dev server with Netlify's Edge Logic proxies and redirects, serverless functions, and addons

EXAMPLES
  $ netlify dev
  $ netlify dev -c "yarn start"
  $ netlify dev -c hugo

COMMANDS
  dev:exec  Exec command
```

## Live Share

To share your ongoing dev session with a coworker, just run Netlify Dev with a `--live` flag:

```bash
netlify dev --live
```

You will get a URL that looks like `https://clever-cray-2aa156-6639f3.netlify.live/`. This can be accessed by anyone as long as you keep your session open.

> Note: there are currently known issues with ending the live session alongside your webdevserver, as well as with live reloading. We are working on fixing it, and would appreciate repro cases, or you may check [existing issues with the `--live` tag](https://github.com/netlify/netlify-dev-plugin/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A--live). In the mean time you can run `ps aux | grep live-tunnel` and kill these sessions manually.

## netlify.toml [dev] block

Netlify Dev is meant to work with zero config for the majority of users, by using its detector system. However you may wish to assert more control over its behavior, and should make use of the new `[dev]` block in `netlify.toml` to do so:

```toml
# sample netlify.toml
[build]
  command = "yarn run build"
  functions = "functions" # netlify dev uses this directory to scaffold and serve your functions
  publish = "dist"

# note: each of these fields are OPTIONAL, with an exception that when you're specifying "command" and "port", you must specify framework = "#custom"
[dev]
  command = "yarn start" # Command to start your dev server
  targetPort = 3000 # The port for your application server, framework or site generator
  port = 8888 # The port that the netlify dev will be accessible on
  publish = "dist" # The path to your static content folder
  jwtRolePath = "app_metadata.authorization.roles" # Object path we should look for role values for JWT based redirects
  autoLaunch = true # a Boolean value that determines if Netlify Dev launches the local server address in your browser
```

## Project detection

Netlify Dev will attempt to detect the site generator or build command that you are using, and run these on your behalf, while adding other development utilities. If you have a JavaScript project, it looks for the best `package.json` script to run for you, using simple heuristics, so you can use the full flexibility of npm scripts. We may add more intelligence to this in the future.

**Overriding the detectors**: The number of [project types which Netlify Dev can detect](https://github.com/netlify/cli/tree/master/src/detectors) is growing, but if yours is not yet supported (contributions welcome!), you can instruct Netlify Dev to run the project on your behalf by declaring it in a `[dev]` block of your `netlify.toml` file.

```toml
# sample dev block in the toml
# note: each of these fields are OPTIONAL and should only be used if you need an override
[dev]
  framework = "#custom"
  command = "yarn start" # Command to start your dev server
  port = 8888 # The port that the netlify dev will be accessible on
  publish = "dist" # If you use a _redirect file, provide the path to your static content folder
```

Or you if your project is being detected incorrectly or positive by multiple
detectors you can specify `framework` option to test only one detector
against your project.

```toml
[dev]
  framework = "create-react-app" # or "#static" to force a static server
```

The `framework` option should be one of the available
[project types which Netlify Dev can detect](https://github.com/netlify/cli/tree/master/src/detectors)
or `#auto` (default) to test all available detectors, `#static` for a static
file server or `#custom` to use `command` option to run an app server and
`targetPort` option to connect to it.

## Explanation of ports in Netlify Dev

There will be a number of ports that you will encounter when using Netlify Dev, especially when running a static site generator like Gatsby which has its own dev server. All the port numbers can be a bit confusing, so here is a brief explainer.

- If your site generator runs on port 8000 for example, Netlify Dev needs to be told to connect to that port, so, it can route the requests successfully to the site generator along with the rest of the local Netlify environment
- If you're running a project we have a detector for, we hardcode those conventional ports so you don't have to supply it yourself. If we have multiple detectors that match, we'll ask you to choose.
- However, sometimes you're using some unrecogized site generator or just have a server you want Netlify Dev to connect to. This is when you go to the `netlify.toml` `[dev]` block to specify exactly what port we should listen to.

As for which port to use while doing local development in Netlify Dev, always look for this box in your console output and use that:

```bash
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │   [Netlify Dev] Server now ready on http://localhost:64939   │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

**Specifying custom ports for Netlify Dev**

Netlify Dev allows you to specify the following parameters for port as both flags and in config file (`netlify.toml` etc.):

- `targetPort`: The port for your application server, framework or site generator.
- `port`: The port for the Netlify Dev server, the one you'll open in the browser.

Netlify Dev tries to acquire these ports but if any of them is not available (already in use by another application), it will throw an error and let you know.

## Redirects

Netlify Dev has the ability emulate the [redirect capability](https://www.netlify.com/docs/redirects/) Netlify provide on the [ADN](https://netlify.com/features/adn) in your local environment. The same redirect rules which you configure to run on the edge, will also work in your local builds.

Netlify dev supports redirect rules defined in either `_redirects` or `netlify.toml` files.

The order of precedence for applying redirect rules is:

1. `_redirects` file (in the project's publish folder)
1. `netlify.toml` file (in the project's publish folder)
1. `netlify.toml` file (in the project's root folder)

See the [Redirects Documentation](https://www.netlify.com/docs/redirects/) for more information on Netlify's redirect and proxying capabilities.

## Environment Variables

If the current project is linked to a Netlify site (`netlify link`), environment variables are pulled down from production and populated in `netlify dev` server. This functionality requires that you're logged in (`netlify login`) and connected to the internet when running `netlify dev`.

Netlify Dev also supports local environment variables through `.env` files.
Netlify Dev will look in project root directory for `.env` file and will provide those variables to the spawned site generator/server and Netlify Functions.

## Netlify Functions

Netlify can also create serverless functions for you locally as part of Netlify Functions. The serverless functions can then be run by Netlify Dev in the same way that would be when deployed to the cloud.

```
## list of major functionality
netlify functions:list
netlify functions:create
netlify functions:invoke
```

A number of function templates are available to get you started, and you can add your own utility functions to suit your own project development needs. You can also locally invoke them with test payload data.

**Create a new function**

```bash
$ netlify functions:create
```

Important note: Your functions will likely have `node_modules` in each folder. These are usually gitignored. You can write bash scripts to install them for production, or use the lightweight [`netlify-lambda install`](https://github.com/netlify/netlify-lambda/blob/master/README.md#netlify-lambda-install) CLI to do it for you.

<details>
<summary>
<b>More detailed usage examples</b>
</summary>

```bash
# Create a new function from one of the
# available templates offered when prompted (see below)
$ netlify functions:create

# alternatives
$ netlify functions:create hello-world # Create a new function with a given name
$ netlify functions:create --name hello-world # same

# Create a new function by cloning a template from a remote url
# organised with dependencies installed into a subdirectory
$ netlify functions:create hello-world --url https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
```

**Deploying unbundled function folders**

Functions that have `node_modules` inside their own folders require these `node_modules` to be installed when deployed. For the time being, **the Netlify build process does not recursively install dependencies for your function folders yet**. You can write `prebuild` or `postinstall` bash scripts to install them for production, or use the lightweight [`netlify-lambda install`](https://github.com/netlify/netlify-lambda/blob/master/README.md#netlify-lambda-install) CLI to do it for you.

**Writing your own Function Templates**

Function templates can specify `addons` that they rely on as well as execute arbitrary code after installation in an `onComplete` hook, if a special `.netlify-function-template.js` file exists in the directory:

```js
// .netlify-function-template.js
module.exports = {
  addons: [
    {
      addonName: 'fauna',
      addonDidInstall: () => {}, // post install function to run after installing addon, eg. for setting up schema
    },
  ],
  onComplete() {
    console.log(`custom-template function created from template!`)
  },
}
```

Instead of using our basic templates, you can use your own by passing it with a --url flag: `netlify functions:create hello-world --url https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware`, specifying any addons and postinstall/complete steps as shown above.

</details>

### Locally Testing Functions with `netlify functions:invoke`

`netlify functions:invoke` allows you to locally test functions going above and beyond a simple GET request in browser. (we only model POSTs now but could easily expand from here).

If you have Netlify Dev running your functions, you can then test sending payloads of data, or authentication payloads:

```bash

# with prompting
netlify functions:invoke # we will prompt you at each step
netlify functions:invoke myfunction # invoke a specific function
netlify functions:invoke --name myfunction # invoke a specific function

# no prompting (good for CI)
netlify functions:invoke --name myfunction --identity # invoke a specific function with netlify identity headers
netlify functions:invoke --name myfunction --no-identity # invoke a specific function without netlify identity headers

# sending payloads
netlify functions:invoke myfunction --payload '{"foo": 1}'
netlify functions:invoke myfunction --querystring "foo=1"
netlify functions:invoke myfunction --payload "./pathTo.json"
```

There are special cases for [event triggered functions](https://www.netlify.com/docs/functions/?utm_source=blog&utm_medium=netlifydev&utm_campaign=devex#event-triggered-functions) (eg `identity-signup`) which will also give you mock data for testing. This makes manual local testing of event triggered functions possible, which drastically improves the development experience.

This is a new feature; ideas and feedback and issues and PR's welcome!

### Function Builders, Function Builder Detection, and Relationship with `netlify-lambda`

**Existing users of `netlify-lambda` should have no change to their workflow by switching to `netlify dev`.** One immediate benefit is no need for [proxying](https://github.com/netlify/netlify-lambda#proxying-for-local-development) since Netlify Dev does that for you.

**Why Function Builders**

Notice that all the functions created by `netlify functions:create` require no build step. This is intentional: we want to remain agnostic of build tooling and thereby create clear expectations: You give us a folder of functions, and we simply serve it (This is called [`zip-it-and-ship-it`](https://github.com/netlify/zip-it-and-ship-it)). If you want to build that folder from a separate source folder, that is entirely under your control. Use whatever tool you like.

This can be helpful, for example, to use ES modules syntax (e.g. `import`/`export`) via webpack, babel transforms via `babel-cli` or `babel-loader`, or strict type-checking and transpilation with TypeScript's `tsc` or other webpack loaders.

We'll call this category of tools **function builders**. In fact, we do maintain an open source function builder dedicated to the task of transforming serverless functions from source to destination via webpack, called [`netlify-lambda`](https://github.com/netlify/netlify-lambda). We maintain [a comparison between Netlify Dev and `netlify-lambda` on its README as well as advice on when to use which or both](https://github.com/netlify/netlify-lambda#netlify-lambda).

**Function Builder Detection**

We don't expect everyone to use function builders, but we expect many will, and want to provide helpful defaults that "just work" for this. To do that, we use a similar detection concept to [project detectors](#Project-detection), and look for common function builder setups.

With this feature, pre-Netlify Dev projects like https://github.com/netlify/create-react-app-lambda can immediately use the `netlify dev` command with no change to code. Currently, we only offer detection for scripts with `netlify-lambda build $SRCFOLDER`. More ideas are welcome.

Netlify Dev will watch `netlify-lambda`'s source folder and rebuild whenever the source file changes, eliminating the need for `netlify-lambda serve` since we don't want a duplicate functions server.

**Bring Your Own Function Builder**

We may offer detection for more function builders in future, and also let you specify function build commands in the `netlify.toml` `[dev]` block. Please share your use case with us if you are likely to need this.

### Using Add-ons

Add-ons are a way for Netlify users to extend the functionality of their Jamstack site/app.

Check out [Add-on docs](https://www.netlify.com/docs/partner-add-ons/) here.

To try out an add-on with Netlify dev, run the `netlify addons:create` command:

```bash
netlify addons:create fauna
```

The above command will install the FaunaDB add-on and provision a noSQL database for your site to leverage. The FaunaDB add-on injects environment variables into your site's build process and the serverless functions.

Or install this [one click example](https://github.com/netlify/fauna-one-click).

After you have installed an add-on, it will be visible with the `netlify addons:list` command inside your site's current working directory. You can use `netlify addons:delete $ADDONNAME` to delete your addon instance.

For now, it is important to include instructions to create addons for each member of your team, as there is no way to specify addons inside of `netlify.toml`. We are working on this.

## Contributing/Local Development

Thanks for contributing! You'll need to follow these steps to run Netlify CLI and `netlify-dev-plugin` locally:

1. uninstall any globally installed versions of `netlify-cli`
2. clone and install deps for https://github.com/netlify/cli
3. `npm link` from inside the `cli` folder

Now you're both ready to start testing `netlify dev` and to contribute to the project! Note these are untested instructions, please get in touch if you're unable to follow them clearly and we'll work with you. Or ping [@swyx](https://twitter.com/swyx).

Note that code that you may be debugging or investigating may be in some transitive dependencies we have published as separate libraries:

- https://github.com/netlify/netlify-rules-proxy/ ([npm](https://www.npmjs.com/package/@netlify/rules-proxy))
- https://github.com/netlify/node-redirects-parser ([npm](https://www.npmjs.com/package/netlify-redirect-parser))
- (not open source) https://www.npmjs.com/package/netlify-redirector
