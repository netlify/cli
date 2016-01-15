var inquire = require("inquirer"),
    when    = require("when"),
    nodefn  = require("when/node"),
    fn      = require("when/callbacks"),
    chalk   = require("chalk"),
    git     = require("../../helpers/git"),
    confirm = require("../../helpers/confirm"),
    gh      = require("github");

var NOTE_URL = "https://www.netlify.com",
    APP_NAME = "Netlify CLI tool";

function createOrUpdateAuthorization(client, credentials) {
  credentials.fingerprint = credentials.fingerprint || new Date().toString();
  var options = {
    scopes: ["write:public_key","repo"],
    note: APP_NAME,
    note_url: NOTE_URL,
    fingerprint: credentials.fingerprint
  }
  if (credentials.otp) {
    options.headers = {"X-GitHub-OTP": credentials.otp};
  }
  client.authenticate({type: "basic", username: credentials.user, password: credentials.password});
  return nodefn.call(client.authorization.create, options).then(function(res) {
    return res.token;
  }).catch(function(err) {
    var msg = err.message && JSON.parse(err.message);
    if (msg.message && msg.message.match(/OTP/)) {
      return fn.call(inquire.prompt, [{name: "otp", message: "Enter 2 Facort Auth code"}]).then(function(answers) {
        credentials.otp = answers.otp;
        return createOrUpdateAuthorization(client, credentials);
      });
    } else if (msg.errors && msg.errors[0] && msg.errors[0].code == "already_exists") {
      return nodefn.call(client.authorization.getAll, options).then(function(auths) {
        for (var i in auths) {
          if ((auths[i].note || auths[i].app.name) == APP_NAME) {
            options.id = auths[i].id;
            return nodefn.call(client.authorization.delete, options).then(function(res) {
              return createOrUpdateAuthorization(client, credentials);
            });
          }
        }
        return when.reject("Error removing existing api token");
      });
    } else {
      return when.reject("Error authorizing with Github: " + err.message);
    }
  });
}

function withGithubClient(config) {
  var client = new gh({version: "3.0.0"});
  if (config.github_token) {
    client.authenticate({type: "oauth", token: config.github_token});
    return when.resolve(client);
  }
  return fn.call(inquire.prompt, [
    {name: "user", message: "GitHub username:"}, {name: "password", message: "GitHub password:", type: "password"}
  ]).then(function(answers) {
    return createOrUpdateAuthorization(client, answers).then(function(token) {
      config.write({github_user: answers.user, github_token: token});
      client.authenticate({type: "oauth", token: config.github_token});
      return client;
    });
  });
};

exports.init = function(config, siteFn) {
  return git.getRepoDetails().then(function(repo) {
    return fn.call(inquire.prompt, [
      {name: "dir", message: "Directory to deploy (blank for current dir):"},
      {name: "cmd", message: "Your build command (middleman build/grunt build/etc):"}
    ]).then(function(answers) {
      console.log("Configuring automated deploys for\n" +
        "  repo: " + chalk.bold(repo.user + "/" + repo.repo) + "\n" +
        "  branch: " + chalk.bold(repo.branch) + "\n" +
        "  dir: " + chalk.bold(answers.dir || ".") + "\n" +
        "  cmd: " + chalk.bold(answers.cmd || "N/A"));
      return confirm.withConfirmation({msg: "Looking good?", default: "yes"}).then(function() {
        return withGithubClient(config).then(function(github) {
          return nodefn.call(github.repos.get, {user: repo.user, repo: repo.repo}).then(function(ghRepo) {
            console.log("Preparing deploy key");

            return config.client.createDeployKey({}).then(function(key) {
              console.log("Adding deploy key to github repo");
              return nodefn.call(github.repos.createKey, {
                user: repo.user,
                repo: repo.repo,
                title: "Netlify Deploy Key",
                key: key.public_key
              }).then(function() {
                console.log("Configuring netlify site");

                return siteFn().then(function(site) { return site.update({
                  repo: {
                    id: ghRepo.id,
                    deploy_key_id: key.id,
                    repo: repo.user + "/" + repo.repo,
                    branch: repo.branch,
                    dir: answers.dir,
                    cmd: answers.cmd
                  }
                }).then(function(site) {
                  config.writeLocalConfig({site_id: site.id, path: answers.dir});

                  console.log("Adding webhook to repository");
                  return nodefn.call(github.repos.createHook,{
                    provider: "github",
                    user: repo.user,
                    repo: repo.repo,
                    name: "web",
                    active: true,
                    events: ["push"],
                    config: {url: site.deploy_hook, content_type: "json"}
                  }).then(function() {
                    console.log("Success! Whenever you push to Github, netlify will build and deploy your site");
                    console.log("  " + chalk.bold(site.url));
                  }, function(err) {
                    if (err.message && err.message.match("already exists")) {
                      console.log("Success! Whenever you push to Github, netlify will build and deploy your site");
                      console.log("  " + chalk.bold(site.url));
                    } else {
                      console.log("Error installing Webhook: ", err);
                      process.exit(1);
                    }
                  });
                })});
              });
            });
          });
        });
      });
    }).catch(function(err) {
      console.log("Error configuring continuous deployments: ");
      console.log(err);
      process.exit(1);
    });
  }).catch(function(err) {
    console.log("netlify init must be called from within a git repository with a github remote");
    console.log(err);
    process.exit(1);
  });
}
