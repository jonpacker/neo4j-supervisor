function supervisor(serverpath) {
  if (!(this instanceof supervisor)) {
    return new supervisor(serverpath);
  }
  
  this.server = serverpath;
}

module.exports = supervisor;
