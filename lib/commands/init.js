var git         = require("../helpers/git"),
    when        = require("when"),
    fn          = require("when/callbacks"),
    chalk       = require("chalk"),
    inquirer    = require("inquirer"),
    fs          = require("fs"),
    confirm     = require("../helpers/confirm"),
    github      = require("./init/github"),
    manual      = require("./init/manual"),
    site_picker = require("../helpers/site_picker"),
    errorLogger = require("../helpers/error_logger");


var sanityCheck = function(config) {
  return function(host) {
    if (fs.existsSync("_config.yml") && !fs.existsSync("Gemfile")) {
      return confirm.withWarning(host,
        "It looks like this a " + chalk.bold("Jekyll") + " site, but you don't have a " + chalk.bold("Gemfile") + ".\n\n" +
        "Add a Gemfile with Jekyll to make netlify install the right version\n" +
        "of Jekyll before running your build."
      );
    }
    if (fs.existsSync("package.json") && fs.existsSync("app.coffee")) {
      try {
        var json = JSON.parse(fs.readFileSync("package.json"));
        if (!((json.dependencies && json.dependencies.roots) || (json.devDependencies && json.devDependencies.roots))) {
          return confirm.withWarning(host,
            "It looks like this is a " + chalk.bold("Roots") + " project, but you don't have roots\n" +
            "as a dependency in your " + chalk.bold("package.json") + "\n\n" +
            "Run " + chalk.bold("npm install roots --save") + " to make sure netlify install's roots\n" +
            "as a dependency before running your build."
          )
        }
      } catch(e) {
        errorLogger.log("Error parsing package.json: ", e);
        return confirm.withWarning(host,
          "You have a malformed package.json in your folder. This will most likely lead to a\n" +
          "broken build on netlify when attempting to install your npm dependencies."
        );
      }
    }
    return when.resolve(host);
  }
}

exports.cmd = function(config, cmd) {
  var sitFn = function() {
    var siteId     = config.getSiteId(cmd);

    if (siteId) {
      return config.client.site(siteId);
    }

    return fn.call(inquirer.prompt, [{name: "confirm", type: "confirm", message: "No site id specified, create a new site"}]).then(function(result) {
      if (result.confirm) { return config.client.createSite({}); }
      return site_picker.pickSite(config.client, {});
    });
  }

  if (cmd.manual) {
    return manual.init(config, sitFn);
  }

  git.getGitHost("origin").then(sanityCheck(config)).then(function(host) {
    switch(host) {
      case "github.com":
        return github.init(config, sitFn);
      case null:
        console.log("Err finding github remote. Make sure this repository has a `origin` remote configured with the " + chalk.bold("ssh") + " protocol");
        process.exit(1);
      default:
        return manual.init(config, sitFn);
    }
  }).catch(function(err) {
    errorLogger.log("Error configuring continuous deployment: ", err);
    process.exit(1);
  });
};
