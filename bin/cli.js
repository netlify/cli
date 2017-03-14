#!/usr/bin/env node

var program    = require("commander"),
    fs         = require("fs"),
    path       = require("path"),
    chalk      = require("chalk"),
    config     = require("../lib/settings/config"),
    createSite = require("../lib/commands/create_site"),
    deleteSite = require("../lib/commands/delete_site"),
    deploy     = require("../lib/commands/deploy"),
    publish    = require("../lib/commands/publish"),
    init       = require("../lib/commands/init"),
    list       = require("../lib/commands/list_sites"),
    updateSite = require("../lib/commands/update_site"),
    openSite   = require("../lib/commands/open"),
    env        = require("../lib/commands/env"),
    updateNotifier = require('update-notifier'),
    pkg = require('../package.json');

updateNotifier({pkg: pkg}).notify();

program
  .version(pkg.version)
  .usage(
    "[options] [command]\n\n" +
    chalk.bold("    The premium hosting service for modern static websites\n\n") +
    "    Read more at https://www.netlify.com/docs/cli"
  )
  .option("-t --access-token <token>", "Override the default Access Token")
  .option("-e --env <environment>", "Specify an environment for the local configuration")

program
  .command("create")
  .description("Create a new site")
  .option("-n --name <name>", "Set <name>.netlify.com")
  .option("-d --custom-domain [domain]", "Set the custom domain for the site")
  .option("-p --password [password]", "Set the password for the site")
  .action(config.wrap(program, createSite.cmd));

program
  .command("deploy")
  .description("Push a new deploy to netlify")
  .option("-s --site-id [id]", "Deploy to site with <id>")
  .option("-p --path [path]", "Path to a folder or zip file to deploy")
  .option("-d --draft", "Deploy as a draft without publishing")
  .action(config.wrap(program, deploy.cmd));

program
  .command("update")
  .description("Updates site attributes")
  .option("-s --site-id [id]", "The site to update")
  .option("-n --name [name]", "Set <name>.netlify.com")
  .option("-d --custom-domain [domain]", "Set the custom domain for the site")
  .option("-p --password [password]", "Set the password for the site")
  .action(config.wrap(program, updateSite.cmd));

program
  .command("delete")
  .description("Delete site")
  .option("-s --site-id [id]", "The id of the site to delete")
  .option("-y --yes", "Don't prompt for confirmation")
  .action(config.wrap(program, deleteSite.cmd));

program
  .command("sites")
  .description("List your sites")
  .option("-g --guest", "List sites you have access to as a collaborator")
  .action(config.wrap(program, list.cmd));

program
  .command("open")
  .description("Open site in the webui")
  .option("-s --site-id [id]", "The id of the site to open")
  .action(config.wrap(program, openSite.cmd));

program
  .command("init")
  .description("Configure continuous deployment")
  .option("-m --manual", "Do a manual setup (no GitHub permissions required)")
  .action(config.wrap(program, init.cmd));

// program
//   .command("env")
//   .description("Output configured env variables")
//   .option("-s --site-id [id]", "Fetch from site with <id>")
//   .option("-f --file [filename]", "Save to file called <filename>")
//   .action(config.wrap(program, env.cmd));

program
  .command("*","",{noHelp: true})
  .action(function(cmd) {
    console.log("Unknown command", cmd);
    process.exit(1);
  });

program.parse(process.argv);

if(!program.args.length) {
  program.help();
}
