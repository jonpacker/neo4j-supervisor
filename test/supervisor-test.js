var assert = require('assert');
var spawn = require('child_process').spawn;
var sv = require('../');
var nvm = require('neo4j-vm');
var async = require('async');
var naan = require('naan');

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

  beforeEach(function() {
    neo = sv(serverpath);
  });

  afterEach(function(done) {
    neo.stop(done);
  });

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
});
