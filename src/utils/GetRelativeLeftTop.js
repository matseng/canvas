HTMLCanvasElement.prototype.getRelativeLeftTop = function (event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = this;

  do {
      totalOffsetX += currentElement.offsetLeft;
      totalOffsetY += currentElement.offsetTop;
  }
  while (currentElement = currentElement.offsetParent)

  var pageX = event.pageX ? event.pageX : event.changedTouches ? event.changedTouches[0].pageX : event.center.x;
  var pageY = event.pageY ? event.pageY : event.changedTouches ? event.changedTouches[0].pageY : event.center.y;

  canvasX = pageX - totalOffsetX;
  canvasY = pageY - totalOffsetY;

  // Fix for variable canvas width
  canvasX = Math.round( canvasX * (this.width / this.offsetWidth) );
  canvasY = Math.round( canvasY * (this.height / this.offsetHeight) );

  return {left:canvasX, top:canvasY};
};

module.exports = HTMLCanvasElement.prototype.getRelativeLeftTop;
