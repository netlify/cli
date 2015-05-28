var git = require("../helpers/git"),
    github = require("./init/github"),
    manual = require("./init/manual");


exports.cmd = function(config, cmd) {
  git.getGitHost("origin", function(err, host) {
    switch(host) {
      case "github.com":
        return github.init(config);
      case null:
        console.log("Err finding github remote. Make sure this repository has a `origin` remote configured with the ssh protocol");
        process.exit(1);
      default:
        return manual.init(config);
    }
  });
};
