var spawn = require('child_process').spawn;
var naan = require('naan');
var join = require('path').join;
var fs = require('fs');

//Run the given neo4j instance with the given command and return the output

var supervisor = function (serverpath) {
  if (!(this instanceof supervisor)) {
    return new supervisor(serverpath);
  }
  
  this.server = {
    path: serverpath,
    bin: join(serverpath, 'bin/neo4j'),
    config: join(serverpath, 'conf/neo4j-server.properties')
  };
}

supervisor.prototype._run = function(command, callback) {
  var neo = spawn(this.server.bin, [command]);
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
};

supervisor.prototype.running = function(callback) {
  this._run('status', function(err, status) {
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

supervisor.prototype.config = function(key, value, callback) {
  if (typeof value == 'function') {
    callback = value;
    value = undefined;
  } 

  var mutateConfig = function(config) {
    if (value === null) {
      var matcher = new RegExp("([\r\n]*)" + key + "=.*[\r\n]*");
      return config.replace(matcher, "$1");
    } else {
      var matcher = new RegExp("([\r\n]*)" + key + "=.*([\r\n]*)");
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
      var matcher = new RegExp("[\r\n]*" + key + "=(.*)[\r\n]*");
      var matches = matcher.exec(config);
      if (!matches) {
        callback(new Error("Configuration key `" + key + "` not found."));
      } else {
        callback(null, matches[1]);
      }
    }
  });

};

module.exports = supervisor;
