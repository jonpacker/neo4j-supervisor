var assert = require('assert');
var spawn = require('child_process').spawn;
var sv = require('../');
var nvm = require('neo4j-vm');
var async = require('async');
var naan = require('naan');
var fs = require('fs');
var join = require('path').join;

describe('supervisor', function() {
  var serverpath;
  var neo;
  before(function(done) {
    nvm('1.9.M01', 'community', false, function(err, path) {
      if (err) return done(err);
      serverpath = path;
      done();
    });
  });

  var assertRunning = function(running, cb) {
    neo.running(function(err, yep) {
      assert.ok(!err)
      assert.ok(yep == running);
      cb();
    });
  };

	var restoreConfig = function(op) {
		return function(cb) {
			fs.readFile(neo.server.config, 'utf8', function(err, config) {
				op(function(err) {
					fs.writeFile(neo.server.config, config, 'utf8', function (ferr) {
						cb(ferr || err);
					});
				});
			});
		};
	};

  beforeEach(function() {
    neo = sv(serverpath);
  });

  afterEach(function(done) {
    neo.stop(done);
  });

  it('should read a configuration value of the server', function(done) {
    var configfile = join(serverpath, 'conf/neo4j-server.properties');
    async.waterfall([
      function(cb) {
        fs.readFile(configfile, 'utf8', function(err, dataz) {
          var match = /org.neo4j.server.webserver.port=(\d+)/gi.exec(dataz);
          if (!match) assert(false, "malformed config file, cannot continue");
          cb(null, match[1]);
        });
      },
      function(port, cb) {
        neo.config('org.neo4j.server.webserver.port', function(err, value) {
          assert(!err, err);
          assert(value == port);
          cb();
        });
      }
    ], done);
  });

  it('should set a configuration value of the server', 
	restoreConfig(function(done) {
    async.waterfall([
      function(cb) {
        neo.config('org.neo4j.server.webserver.port', '12345', function(err) {
          cb(err, '12345');
        });
      },
      function(newPort, cb) {
        neo.config('org.neo4j.server.webserver.port', function(err, port) {
          assert(port == newPort);
          cb(err);
        });
      }
		], done);
  }));

  it('should not clobber configuration formatting', 
	restoreConfig(function(done) {
    var configfile = join(serverpath, 'conf/neo4j-server.properties');
    async.waterfall([
      function(cb) {
        fs.readFile(configfile, 'utf8', function(err, dataz) {
          cb(null, dataz);
        });
      },
      function(config, cb) {
        neo.config('org.neo4j.server.webserver.port', function(err, port) {
          cb(err, config, port);
        });
      },
      function(config, port, cb) {
        neo.config('org.neo4j.server.webserver.port', '12345', function(err) {
          cb(err, config, port);
        });
      },
      function(config, port, cb) {
        neo.config('org.neo4j.server.webserver.port', port, function(err) {
          cb(err, config, port);
        });
      },
      function(config, port, cb) {
        fs.readFile(configfile, 'utf8', function(err, dataz) {
          assert(dataz == config);
          cb();
        });
      }
    ], done);
  }));
  
  it('should add a new config value to the configuration', 
	restoreConfig(function(done) {
    async.series([
      function(cb) {
        neo.config('this.is.a.new.thing', 'potato', cb);
      },
      function(cb) {
        neo.config('this.is.a.new.thing', function(err, val) {
          assert(!err, err);
          assert(val == 'potato');
          cb();
        });
      },
      naan.b.curry(neo, neo.config, 'this.is.a.new.thing', null)
    ], done);
  }));

  it('should delete a config value', restoreConfig(function(done) {
    async.series([
      naan.b.curry(neo, neo.config, 'thing123', '456'),
      naan.b.curry(neo, neo.config, 'thing123', null),
      function(cb) {
        neo.config('thing123', function(err) {
          assert(!!err);
          cb();
        });
      }
    ], done);
  }));

  it('should check if a server is running', function(done) {
    assertRunning(false, done);
  });

  it('should start a server', function(done) {
    neo.start(function(err) {
      assert.ok(!err);
      assertRunning(true, done);
    });
  });

  it('should stop a server', function(done) {
    async.series([
      neo.start.bind(neo),
      naan.curry(assertRunning, true),
      neo.stop.bind(neo),
      naan.curry(assertRunning, false)
    ], done);
  });

  it('should get the pid of a running server', function(done) {
    var checkPid = function(pid, cb) {
      var ps = spawn('ps', ['-p', pid]);
      var output = '';
      ps.stdout.on('data', function(data) { output += data });
      ps.on('exit', function() {
        assert(!!/neo4j/.exec(output));
        cb();
      });
    };
    
    async.series([
      neo.start.bind(neo),
      function(cb) {
        neo.pid(function(err, pid) {
          checkPid(pid, cb);
        });
      },
      neo.stop.bind(neo),
      function(cb) {
        neo.pid(function(err, pid) {
          assert(pid == null);
          cb();
        });
      }
    ], done);
  });

  it('should restart the server', function(done) {
    var firstPid;
    async.series([
      neo.start.bind(neo),
      function(cb) {
        neo.pid(function(err,pid) {
          firstPid = pid;
          cb();
        });
      },
      neo.restart.bind(neo),
      naan.curry(assertRunning, true),
      function(cb) {
        neo.pid(function(err, pid) {
          assert(firstPid != pid);
          cb();
        });
      }
    ], done);
  }); 
});
