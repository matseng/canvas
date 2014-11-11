
var _canvasElement;

var getRelativeLeftTop = function (event) {
  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = _canvasElement;

  do {
      totalOffsetX += _canvasElement.offsetLeft;
      totalOffsetY += _canvasElement.offsetTop;
  }
  while (currentElement = currentElement.offsetParent)

  var pageX = event.pageX ? event.pageX : event.changedTouches ? event.changedTouches[0].pageX : event.center.x;
  var pageY = event.pageY ? event.pageY : event.changedTouches ? event.changedTouches[0].pageY : event.center.y;

  canvasX = pageX - totalOffsetX;
  canvasY = pageY - totalOffsetY;

  // Fix for variable canvas width
  canvasX = Math.round( canvasX * (_canvasElement.width / _canvasElement.offsetWidth) );
  canvasY = Math.round( canvasY * (_canvasElement.height / _canvasElement.offsetHeight) );

  return {left:canvasX, top:canvasY};
};

getRelativeLeftTop.set = function(canvasElement) {
  _canvasElement = canvasElement;
}

module.exports = getRelativeLeftTop;
