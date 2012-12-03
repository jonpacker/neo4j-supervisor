var assert = require('assert');
var spawn = require('child_process').spawn;
var sv = require('../');
var nvm = require('neo4j-vm');

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

  beforeEach(function() {
    neo = sv(serverpath);
  });

  afterEach(function(done) {
    neo.stop(done);
  });

  it('should check if a server is running', function(done) {
    neo.running(function(yep) {
      assert.ok(!yep);
      done();
    });
  });

  it('should start a server', function(done) {
    neo.start(function(err) {
      assert.ok(!err);
      neo.running(function(yep) {
        assert.ok(yep);
        done();
      });
    });
  });
});
