module.exports = (function() {

  var Rect = function(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  Rect.prototype.getDimensions = function(scale) {
    var x, y, width, height;
    x = this.x * scale;
    y = this.y * scale;
    width = this.width * scale;
    height = this.height * scale;
    // return [this.x, this.y, this.width, this.height];
    // console.log(x,y,scale);
    return [x, y, width, height];
  };

  return Rect;

})();
