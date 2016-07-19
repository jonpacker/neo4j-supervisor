var spawn = require('child_process').spawn;
var naan = require('naan');
var async = require('async');
var join = require('path').join;
var fs = require('fs');
var url = require('url');
var path = require('path');
var rimraf = require('rimraf');
var assert = require('assert');
var semver = require('semver');
var commandExists = require('command-exists');
var augur = require('augur');

var reattachCommandExists = augur();
commandExists('reattach-to-user-namespace', reattachCommandExists);

//Run the given neo4j instance with the given command and return the output

var supervisor = function (serverpath, version) {
  if (!(this instanceof supervisor)) {
    return new supervisor(serverpath, version);
  }

  assert(version, 'version must be specified')
  this.version = version;
  
  this.server = {
    path: serverpath,
    bin: join(serverpath, 'bin/neo4j'),
  };

  if (semver.gte(this.version, '3.0.0')) {
    this.server.config = join(serverpath, 'conf/neo4j.conf');
  } else {
    this.server.config = join(serverpath, 'conf/neo4j-server.properties');
  }
}

var addConfigCurries = function(configCurries) {
	for (var target in configCurries) {
		this[target] = naan.b.curry(this, this.config, configCurries[target]);
	}	
};
    addConfigCurries.call(this, {
      'host': 'org.neo4j.server.webserver.address',
      'port': 'org.neo4j.server.webserver.port'
    });

supervisor.prototype.host = function(newHost, callback) {
  if (semver.gte(this.version, '3.0.0')) {
    if (typeof newHost == 'function') {
      callback = newHost;
      newHost = null;
    }
    if (!newHost) {
      this.config('dbms.connector.http.address', function(err, addr) {
        if (err) return callback(err);
        else callback(null, addr.split(':')[1])
      });
    } else {
      this.port(function(err, port) {
        if (err) return callback(err);
        this.config('dbms.connector.http.address', [newHost, port].join(':'), callback);
      });
    }
  } else {
    this.config('org.neo4j.server.webserver.address', newHost, callback);
  }
};

supervisor.prototype.port = function(newPort, callback) {
  if (semver.gte(this.version, '3.0.0')) {
    if (typeof newPort == 'function') {
      callback = newPort;
      newPort = null;
    }
    if (!newPort) {
      this.config('dbms.connector.http.address', function(err, addr) {
        if (err) return callback(err);
        else callback(null, addr.split(':')[0])
      });
    } else {
      this.port(function(err, host) {
        if (err) return callback(err);
        this.config('dbms.connector.http.address', [host, newPort].join(':'), callback);
      });
    }
  } else {
    this.config('org.neo4j.server.webserver.port', newPort, callback);
  }
};


supervisor.prototype._run = function(command, callback) {
  reattachCommandExists.then(function(err, withReattach) {
    var cmd = withReattach ? 'reattach-to-user-namespace ' + this.server.bin : this.server.bin;
    var neo = spawn(cmd, [command], {detached:true});
    var output = '';
    var error = '';
    neo.stdout.on('data', function(data) {
      output += data;
    });
    neo.stderr.on('data', function(data) {
      error += data;
    });
    neo.on('exit', function(code) {
      if (code) callback(new Error(error || output));
      else callback(null, output);
    });
  });
};

supervisor.prototype.running = function(callback) {
  this._run('status', function(err, status) {
    if (err && err.message.match(/not running/)) return callback(null, false);
    if (err) return callback(err);
    callback(null, !!/pid\s+\d+/.exec(status));
  });
};

supervisor.prototype.start = function(callback) {
  this._run('start', callback);
};
supervisor.prototype.stop = function(callback) {
  this._run('stop', callback);
};
supervisor.prototype.restart = function(callback) {
  this._run('restart', callback);
};

supervisor.prototype.pid = function(callback) {
  this._run('status', function(err, status) {
    if (err) return callback(err, null);
    var match = /pid\s+(\d+)/.exec(status);
    callback(null, match ? parseInt(match[1], 10) : null);
  });
};

supervisor.prototype.endpoint = function(callback) {
	var self = this;
	var configFetchNoError = function(key, callback) {
		self.config(key, function(err, value) {
			if (err && err.code != 'ENOKEY') return callback(err);
			else callback(null, value);
		});
	};
  var settingsToGet;
  if (semver.gte(this.version, '3.0.0')) {
    settingsToGet = [ 'dbms.connector.http.address' ];
  } else {
    settingsToGet = [
      'org.neo4j.server.webserver.address',
      'org.neo4j.server.webserver.port',
      'org.neo4j.server.webadmin.data.uri'
    ];
  }
	async.map(settingsToGet, configFetchNoError, function(err, settings) {
		if (err && err != 'ENOKEY') return callback(err);
    var addr, host, port;
    if (semver.gte(self.version, '3.0.0')) {
      host = settings[0].split(':')[0];
      port = settings[0].split(':')[1];
    } else {
      host = settings[0] || '127.0.0.1';
      port = settings[1] || '7474';
    }
		callback(null, {
			server: url.format({
				protocol: 'http',
				hostname: host,
				port: port
			}),
			endpoint: settings[2] || '/db/data'
		});
	});
};

supervisor.prototype.config = function(key, value, callback) {
  if (typeof value == 'function') {
    callback = value;
    value = undefined;
  } 

  var mutateConfig = function(config) {
    if (value === null) {
      var matcher = new RegExp("(^|[\r\n]+)(?![#!])" + key + "=.*[\r\n]*");
      return config.replace(matcher, "$1");
    } else {
      var matcher = new RegExp("(^|[\r\n]+)(?![#!])" + key + "=.*([\r\n]*)");
			if (!config.match(matcher)) {
				// should probably check the line endings of the file first.
				return config + '\r\n' + key + '=' + value;
			} else {
				return config.replace(matcher, '$1' + key + '=' + value + '$2');
			}
    }
  };
  
	var self = this;
  fs.readFile(this.server.config, 'utf8', function(err, config) {
    if (err) return callback(err);
    
    if (value !== undefined) {
      fs.writeFile(self.server.config, mutateConfig(config), 'utf8', callback);
    } else {
      var matcher = new RegExp("(^|[\r\n]+)(?![#!])" + key + "=(.*)[\r\n]*");
      var matches = matcher.exec(config);
      if (!matches) {
        var err = new Error("Configuration key `" + key + "` not found.");
				err.code = 'ENOKEY';
				callback(err);
      } else {
        callback(null, matches[2]);
      }
    }
  });
};

supervisor.prototype.clean = function(callback) {
	var self = this, wasRunning;

	var cleanData = function(dbpath, callback) {
		dbpath = path.join(self.server.path, dbpath);
		rimraf(dbpath, function(err) {
			if (err && err.code != 'ENOENT') return callback(err);
			fs.mkdir(dbpath, callback);
		});
	};

	async.waterfall([
		this.running.bind(this),
		function(running, next) {
			wasRunning = running;
			if (!running) return next();
			self.stop(function(err) { next(err) });
		},
		this.config.bind(this, 'org.neo4j.server.database.location'),
		cleanData,
		function(next) {
			if (!wasRunning) return next();
			self.start(function(err) { next(err) });
		}
	], callback);
};

module.exports = supervisor;
