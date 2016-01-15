var git    = require("../helpers/git"),
    fn     = require("when/callbacks"),
    chalk  = require("chalk"),
    github = require("./init/github"),
    manual = require("./init/manual");

exports.cmd = function(config, cmd) {
  git.getGitHost("origin").then(function(host) {
    switch(host) {
      case "github.com":
        return github.init(config);
      case null:
        console.log("Err finding github remote. Make sure this repository has a `origin` remote configured with the ssh protocol");
        process.exit(1);
      default:
        return manual.init(config);
    }
  }).catch(function(err) {
    console.log("Error configuring continuous deployment:")
    console.log("  " + chalk.bold(err));
    process.exit(1);
  });
};
