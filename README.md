# neo4j-supervisor

manage a neo4j server installation

## install

```
npm install neo4j-supervisor
```

## example

```
var supervise = require('neo4j-supervisor');
var neo = supervise('/potato/neo4j');

neo.clean(function(err) { ... }); // purge all data from the database
neo.running(function(yep) { ... }); // check if instance is running
neo.start(function() { ... }); // start an instance
//... etc - see below for a list of available functions
```

### portability

doesn't work on windows. :~~[

## functions

**all the callbacks are in the format `function(err, output)` unless otherwise
specified**

* **neo.clean(cb)** - purge all data from the database. this is rather forceful - it
  physically wipes that data from the disk. therefore I don't suggest trying it
  while the server is running. (but if you feel like trying it, go ahead! i
  won't stop you.)
* **neo.running(cb)** - check if the server is running. callback is given one arg,
  a boolean that's set to true if the server is running
* **neo.start(cb)** - start the server
* **neo.stop(cb)** - stop the server
* **neo.restart(cb)** - restart the server
* **neo.config([key], [value], cb)** - either get all of the server's
  configuration values (as an obj), or a single key, or set a value, depending
  on which args are passed (key and value are optional).
* **neo.port([port], cb)** - if `port` is specified, set the port of the server
  to `port`. otherwise, get the port of the server.
* **neo.host([host], cb)** - same as `port`, but with hostname.
* **neo.pid(cb)** - find the pid of the server or null
* **neo.endpoint(cb)** - get the endpoint configuration of the server. calls
	back with an object containing `server`—the location of the server with
  protocol and port, and `endpoint`—the path of the api endpoint on top of
	`server`. this conveniently fits straight into [seraph](http://www.github.com/brikteknologier/seraph).
