var assert = require('assert');
var spawn = require('child_process').spawn;
var sv = require('../');
var nvm = require('neo4j-vm');

describe('supervisor', function() {
  var serverpath;
  before(function(done) {
    nvm('1.9.M01', 'community', false, function(err, path) {
      if (err) return done(err);
      serverpath = path;
      done();
    });
  });

  it('should check if a server is running', function(done) {
    var neo = sv(serverpath);
    sv.running(function(yep) {
      assert.ok(!yep);
      done();
    });
  });
});
