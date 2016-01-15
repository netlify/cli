var inquirer = require("inquirer"),
    fn       = require("when/callbacks"),
    chalk    = require("chalk"),
    git      = require("../../helpers/git"),
    confirm  = require("../../helpers/confirm");

exports.init = function(config, siteFn) {
  return git.getRepoDetails().then(function(repo) {
    return fn.call(inquirer.prompt, [
      {name: "dir", message: "Directory to deploy (blank for current dir):"},
      {name: "cmd", message: "Your build command (middleman build/grunt build/etc):"}
    ]).then(function(results) {
      console.log("Configuring automated deploys for\n" +
        "  repo: " + chalk.bold(repo.url) + "\n" +
        "  branch: " + chalk.bold(repo.branch) + "\n" +
        "  dir: " + chalk.bold(results.dir || ".") + "\n" +
        "  cmd: " + chalk.bold(results.cmd || "N/A"));
      return confirm.withConfirmation({msg: "Looking good?"}).then(function() {
        console.log("Preparing deploy key");
        return config.client.createDeployKey({}).then(function(key) {
          console.log(
            chalk.bold("\nGive this Netlify SSH public key access to your repo:\n\n") +
            key.public_key + "\n\n"
          );
          return confirm.withConfirmation({msg: "I've installed the deploy key", default: "yes"}).then(function() {
            return siteFn().then(function(site) { return site.update({
              repo: {
                provider: "manual",
                deploy_key_id: key.id,
                repo: repo.url,
                branch: repo.branch,
                dir: results.dir,
                cmd: results.cmd
              }
            }).then(function(site) {
              config.writeLocalConfig({site_id: site.id, path: results.dir});

              console.log(
                chalk.bold("\nConfigure the following webhook for your repo:\n\n") +
                chalk.bold(site.deploy_hook) + "\n\n"
              );
              return confirm.withConfirmation({msg: "I've installed the webhook"}).then(function() {
                console.log("Success! Whenever you push to git, Netlify will build and deploy your site");
                console.log("  " + chalk.bold(site.url));
              });
            })}).catch(function(err) {
              console.log("Error creating netlify site.");
              console.log("  " + chalk.bold(err));
              process.exit(1);
            });
          });
        }).catch(function(err) {
          console.log("Failed to prepare a deploy key for the github repo");
          console.log("  " + chalk.bold(err));
          process.exit(1);
        });
      });
    })
  }).catch(function(err) {
    console.log("netlify init must be called from within a git repository with a github remote")
    process.exit(1);
  });
}
