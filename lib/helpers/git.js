var when  = require("when"),
    fn    = require("when/node"),
    spawn = require('child_process').spawn,
    http  = require('http');

exports.deleteArrayEmptyValues_ = function(values) {
    return values.filter(function(value) {
        return value !== '';
    });
};

exports.exec = function(cmd, args, opt_log) {
    var buf = '',
        errbuf = '',
        git;

    args.unshift(cmd);

    git = spawn("git", exports.deleteArrayEmptyValues_(args));

    git.stdout.on('data', function(data) {
        buf += data;
        if (opt_log) {
            console.log(data.toString());
        }
    });

    git.stderr.on('data', function(data) {
        errbuf += data;
        if (opt_log) {
            console.log(data.toString());
        }
    });

    return new when.Promise(function(resolve, reject) {
      git.on('close', function(err) {
          if (err) {
            return reject(err);
          }
          return resolve(buf);
      });
    });
};

exports.getConfig = function(key) {
    return exports.exec('config', ['--get', key]).then(function(data) {
      return data.trim();
    }, function(error) {
      throw(new Error("Unable to read git config - is this a git repository?"));
    });
};

exports.getCurrentBranch = function() {
    return exports.exec('symbolic-ref', ['HEAD']).then(function(data) {
        return data.substring(data.lastIndexOf('/') + 1).trim();
    });
};

exports.getRemoteUrl = function(remote) {
    return exports.getConfig('remote.' + remote + '.url');
};

exports.getRepoFromRemoteURL = function(url) {
    var parsed = exports.parseRemoteUrl(url);

    return parsed && parsed[1];
};

exports.getUserFromRemoteUrl = function(url) {
    var parsed = exports.parseRemoteUrl(url);

    return parsed && parsed[0];
};

exports.getGitHostFromRemoteUrl = function(url) {
  var parsed = exports.parseGitHost(url);

  return parsed && parsed[0];
};

exports.getRepo = function(remote) {
    return exports.getRemoteUrl(remote).then(function(data) {
        return exports.getRepoFromRemoteURL(data);
    });
};

exports.getUser = function(remote) {
    return exports.getRemoteUrl(remote).then(function(data) {
        return exports.getUserFromRemoteUrl(data);
    });
};

exports.getGitHost = function(remote) {
  return exports.getRemoteUrl(remote).then(function(data) {
    return exports.getGitHostFromRemoteUrl(data);
  });
};

exports.parseRemoteUrl = function(url) {
    var parsed = /[\/:]([\w-]+)\/(.*?)(?:\.git)?$/.exec(url);

    if (parsed) {
        parsed.shift();
    }

    return parsed;
};

exports.parseGitHost = function(url) {
  var parsed = /^(?:ssh:\/\/)?git@([^:]+)/.exec(url);

  if (parsed) {
    parsed.shift();
  }

  return parsed;
}

exports.getRepoDetails = function() {
  return when.join(
    exports.getRemoteUrl("origin"),
    exports.getCurrentBranch()
  ).then(function(data) {
    var url = data[0], branch = data[1];
    return {
      url: url,
      user: exports.getUserFromRemoteUrl(url),
      repo: exports.getRepoFromRemoteURL(url),
      branch: branch
    };
  });
}
