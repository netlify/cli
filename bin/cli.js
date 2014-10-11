#!/usr/bin/env node

var program = require("commander"),
    config = require("./../lib/settings/config"),
    createSite = require("./../lib/commands/create_site");

program
  .version("0.0.1")
  .option("-t", "--access-token", "Override the default Access Token")

program
  .command("init")
  .description("Configure deployments for the current dir")
  .action(function(cmd) {
    console.log("initializing");
  });

program
  .command("create")
  .description("Create a new site")
  .action(config.wrap(createSite.cmd))

program
  .command("update")
  .description("Updates attributes of a site")
  .action(function(cmd) {
    console.log("updating")
  })

program
  .command("deploy [path]")
  .description("Deploy a new version")
  .action(function(path, options) {
    path = path || '.'
    console.log("deploying %s", path)
  });

program
  .command("delete")
  .description("Deletes a site")
  .action(function(cmd) {
    console.log("deleting")
  });

program.parse(process.argv);

if(!program.args.length) {
  program.help();
}
