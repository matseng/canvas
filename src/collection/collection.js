var Rect = require('./shapes.js')

module.exports = (function() {

  var Collection = function() {
    this.shapes = [];
    this.run();
  }

  Collection.prototype.run = function() {
    this.add( new Rect(25,25,100,100) );
    this.add( new Rect(125,125,200,200) );
  };

  Collection.prototype.add = function(shape) {
    this.shapes.push(shape);
  };

  Collection.prototype.get = function() {
    return this.shapes;
  };
  
  return new Collection();

})();
