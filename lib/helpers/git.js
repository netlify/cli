var spawn = require('child_process').spawn,
    http  = require('http');

exports.deleteArrayEmptyValues_ = function(values) {
    return values.filter(function(value) {
        return value !== '';
    });
};

exports.exec = function(cmd, args, opt_callback, opt_log) {
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

    git.on('close', function(err) {
        opt_callback && opt_callback(err, err ? errbuf : buf);
    });
};

exports.getConfig = function(key, opt_callback) {
    exports.exec('config', ['--get', key], function(err, data) {
        opt_callback(err, data.trim());
    });
};

exports.getCurrentBranch = function(opt_callback) {
    exports.exec('symbolic-ref', ['HEAD'], function(err, data) {
        data = data.substring(data.lastIndexOf('/') + 1);
        opt_callback(err, data.trim());
    });
};

exports.getRemoteUrl = function(remote, opt_callback) {
    exports.getConfig('remote.' + remote + '.url', opt_callback);
};

exports.getRepoFromRemoteURL = function(url) {
    var parsed = exports.parseRemoteUrl(url);

    return parsed && parsed[1];
};

exports.getUserFromRemoteUrl = function(url) {
    var parsed = exports.parseRemoteUrl(url);

    return parsed && parsed[0];
};

exports.getRepo = function(remote, opt_callback) {
    exports.getRemoteUrl(remote, function(err, data) {
        opt_callback(err, exports.getRepoFromRemoteURL(data));
    });
};

exports.getUser = function(remote, opt_callback) {
    exports.getRemoteUrl(remote, function(err, data) {
        opt_callback(err, exports.getUserFromRemoteUrl(data));
    });
};

exports.parseRemoteUrl = function(url) {
    var parsed = /[\/:]([\w-]+)\/(.*?)(?:\.git)?$/.exec(url);

    if (parsed) {
        parsed.shift();
    }

    return parsed;
};
