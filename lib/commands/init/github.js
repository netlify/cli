var prompt  = require("prompt"),
    chalk   = require("chalk"),
    git     = require("../../helpers/git"),
    confirm = require("../../helpers/confirm"),
    gh      = require("github");

var NOTE_URL = "https://www.netlify.com";

var exitWithError = function(msg, err) {
  console.log(msg);
  if (err) {
    console.log("Details: " + chalk.bold(err));
  }
  process.exit(1);
};

var createOrUpdateAuthorization = function(client, credentials, cb) {
  credentials.fingerprint = credentials.fingerprint || new Date().toString();
  var options = {
    scopes: ["write:public_key","repo"],
    note: "Netlify CLI tool",
    note_url: NOTE_URL,
    fingerprint: credentials.fingerprint
  }
  if (credentials.otp) {
    options.headers = {"X-GitHub-OTP": credentials.otp};
  }
  client.authenticate({type: "basic", username: credentials.user, password: credentials.password});
  client.authorization.create(options, function(err, res) {
    if (err) {
      var msg = err.message && JSON.parse(err.message);
      if (msg.message && msg.message.match(/OTP/)) {
        prompt.start()
        prompt.get([
          {name: "otp", description: "Enter 2 Factor Auth code:"}
        ], function(err, results) {
          credentials.otp = results.otp;
          createOrUpdateAuthorization(client, credentials, cb);
        });
      } else if (msg.errors && msg.errors[0] && msg.errors[0].code == "already_exists") {
        client.authorization.getAll(options, function(err, auths) {
          if (err) {
            console.log(err);
            exitWithError("Error authorizing with Github");
          }
          for (var i in auths) {
            if (auths[i].note_url == NOTE_URL) {
              options.id = auths[i].id;
              client.authorization.delete(options, function(err, res) {
                if (err) {
                  exitWithError("Error deleting existing authorization with Github");
                }
                createOrUpdateAuthorization(client, credentials, cb);
              });
              return;
            }
          }
          exitWithError("Error authorizing with Github");
        });
      } else {
        exitWithError("Error authorizing with Github");
      }
    } else {
      cb(res.token);
    }
  });
}

var withGithubClient = function(config, cb) {
  var client = new gh({version: "3.0.0"});
  if (config.github_token) {
    client.authenticate({type: "oauth", token: config.github_token});
    cb(client);
  } else {
    prompt.start()
    prompt.get([
      {name: "user", description: "Github username"}, {name: "password", description: "Github password", hidden:true}
    ], function(err, results) {
      createOrUpdateAuthorization(client, results, function(token) {
        config.write({github_user: results.user, github_token: token});
        client.authenticate({type: "oauth", token: config.github_token});
        cb(client);
      });
    });
  }

};

var getRepoDetails = function(cb) {
  git.getUser("origin", function(err, user) {
    if (err) { return cb(err); }
    git.getRepo("origin", function(err, repo) {
      if (err) { return cb(err); }
      git.getCurrentBranch(function(err, branch) {
        if (err) { return cb(err); }
        cb(null, {
          user: user,
          repo: repo,
          branch: branch
        });
      });
    });
  });
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
        "  repo: " + chalk.bold(repo.user + "/" + repo.repo) + "\n" +
        "  branch: " + chalk.bold(repo.branch) + "\n" +
        "  dir: " + chalk.bold(results.dir || ".") + "\n" +
        "  cmd: " + chalk.bold(results.cmd || "N/A"));
      confirm.withConfirmation({msg: "Looking good?", default: "yes"}, function() {
        withGithubClient(config, function(github) {
          github.repos.get({user: repo.user, repo: repo.repo}, function(err, ghRepo) {
            console.log("Preparing deploy key");
            config.client.createDeployKey({}, function(err, key) {
              if (err) {
                exitWithError("Failed to prepare a deploy key for the github repo", err);
              }

              console.log("Adding deploy key to github repo");
              github.repos.createKey({
                user: repo.user,
                repo: repo.repo,
                title: "Netlify Deploy Key",
                key: key.public_key
              }, function(err) {
                if (err) {
                  exitWithError("Error adding deploy key to repository: " + err);
                }
                console.log("Creating netlify site");

                config.client.createSite({
                  repo: {
                    id: ghRepo.id,
                    deploy_key_id: key.id,
                    repo: repo.user + "/" + repo.repo,
                    branch: repo.branch,
                    dir: results.dir,
                    cmd: results.cmd
                  }
                }, function(err, site) {
                  if (err) {
                    exitWithError("Error creating netlify site.");
                  }
                  config.writeLocalConfig({site_id: site.id, path: results.dir});

                  console.log("Adding webhook to repository");
                  github.repos.createHook({
                    provider: "github",
                    user: repo.user,
                    repo: repo.repo,
                    name: "web",
                    active: true,
                    events: ["push"],
                    config: {url: site.deploy_hook, content_type: "json"}
                  }, function(err) {
                    if (err) {
                      exitWithError("Error adding webhook to repository!\n  Please install web hook with url " + chalk.bold(site.deploy_hook), err);
                    }

                    console.log("Success! Whenever you push to Github, Netlify will build and deploy your site");
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
