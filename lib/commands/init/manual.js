var prompt  = require("prompt"),
    chalk   = require("chalk"),
    git     = require("../../helpers/git"),
    confirm = require("../../helpers/confirm");

var exitWithError = function(msg, err) {
  console.log(msg);
  if (err) {
    console.log("Details: " + chalk.bold(err));
  }
  process.exit(1);
};

exports.init = function(config) {
  git.getRepoDetails(function(err, repo) {
    if (err) {
      exitWithError("netlify init must be called from within a git repository with a github remote");
    }

    prompt.start();
    prompt.get([
      {name: "dir", description: "Directory to deploy (blank for current dir)"},
      {name: "cmd", description: "Your build command (middleman build/grunt build/etc)"}
    ], function(err, results) {
      console.log("Configuring automated deploys for\n" +
        "  repo: " + chalk.bold(repo.url) + "\n" +
        "  branch: " + chalk.bold(repo.branch) + "\n" +
        "  dir: " + chalk.bold(results.dir || ".") + "\n" +
        "  cmd: " + chalk.bold(results.cmd || "N/A"));
      confirm.withConfirmation({msg: "Looking good?", default: "yes"}, function() {
        // Create deploy key
        // console.log("Please install this public key in your repo and to give access...")

        // Create site with repo settings
        // console.log("Please install this webhook in your repository: ...");

        console.log("Preparing deploy key");
        config.client.createDeployKey({}, function(err, key) {
          if (err) {
            exitWithError("Failed to prepare a deploy key for the github repo", err);
          }
          console.log(
            chalk.bold("\nGive this Netlify SSH public key access to your repo:\n\n") +
            key.public_key + "\n\n"
          );
          confirm.withConfirmation({msg: "I've installed the deploy key", default: "yes"}, function() {
            config.client.createSite({
              repo: {
                provider: "manual",
                deploy_key_id: key.id,
                repo: repo.url,
                branch: repo.branch,
                dir: results.dir,
                cmd: results.cmd
              }
            }, function(err, site) {
              if (err) {
                exitWithError("Error creating netlify site.");
              }
              config.writeLocalConfig({site_id: site.id, path: results.dir});

              console.log(
                chalk.bold("\nConfigure the following webhook for your repo:\n\n") +
                chalk.bold(site.deploy_hook) + "\n\n"
              );
              confirm.withConfirmation({msg: "I've installed the webhook", default: "yes"}, function() {
                console.log("All done!");
              });
            });
          });
        });
      });
    })
  });
}
