(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var CanvasDemo = require('./nav/nav.js');

module.exports = function() {

  window.onload = run;

  function run() {
   var cd = new CanvasDemo();
  };

  HTMLCanvasElement.prototype.relMouseCoords = function (event) {
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

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    // Fix for variable canvas width
    canvasX = Math.round( canvasX * (this.width / this.offsetWidth) );
    canvasY = Math.round( canvasY * (this.height / this.offsetHeight) );

    return {x:canvasX, y:canvasY}
  }
};

},{"./nav/nav.js":3}],2:[function(require,module,exports){
var canvas = require('../canvas.js');

canvas();

// console.log('testing testing');

},{"../canvas.js":1}],3:[function(require,module,exports){

module.exports = CanvasDemo;

// function hw() {
//   var test = 'hello world watch'
//   console.log(test);
//   return test;
// };

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

// var CanvasDemo = function() {
function CanvasDemo() {
  this.canvas = document.getElementById('canvas');
  this.shapes = [];
  this.translateX = 0;
  this.translateY = 0;
  this.scale = 1;

  if ( this.canvas.getContext ) {
    this.shapes.push( new Rect(25,25,100,100) );
    this.shapes.push( new Rect(125,125,200,200) );
    this.ctx = canvas.getContext('2d');
    this.resizeCanvas();
    window.onresize = this.resizeCanvas.bind(this);
    this.addEventListeners();
    this.draw();
  }
}

var mousePointInitial = {};
var shapePointInitial = {};
var translateInitial = {};
var dragBound;
var mouseupBound;
var _resetBound;

CanvasDemo.prototype.addEventListeners = function() {
  this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
  this.canvas.addEventListener('mousewheel', this.mousewheel.bind(this));
};

CanvasDemo.prototype.mousewheel = function(event) {
  var mouse = this.canvas.relMouseCoords(event);
  var scalePrev = this.scale;

  if (event.wheelDeltaY < 0) {
    this.scale = this.scale * 1.05;
  } else {
    this.scale = this.scale * 0.95;
  }

  this.translateX = this.translateX - _getTranslateDelta(mouse.x, scalePrev, this.scale);
  this.translateY = this.translateY - _getTranslateDelta(mouse.y, scalePrev, this.scale);

  function _getTranslateDelta(x, scalePrev, scaleNew) {
    var translateDelta = (x / scalePrev * scaleNew - x) / scaleNew;
    return translateDelta;
  }

  console.log(this.scale);
  this.draw();
};

CanvasDemo.prototype.mousedown = function(event) {
  var mouse = this.canvas.relMouseCoords(event);
  var point = {};
  point.x = mouse.x / this.scale - this.translateX;
  point.y = mouse.y / this.scale - this.translateY;

  var shape = this.getShapeinBounds(point);
  mousePointInitial = point;
  mouseupBound = this.mouseup.bind(this);
  console.log(shape);
  if ( shape ) {
    shapePointInitial = {x: shape.x, y: shape.y};
    dragBound = this.drag.bind(this, shape);
    _resetBound = _reset.bind(this, dragBound, mouseupBound);
    this.canvas.addEventListener('mousemove', dragBound);
  } else {
    translateInitial = {x: this.translateX, y: this.translateY};
    translateBound = this.translate.bind(this);
    _resetBound = _reset.bind(this, translateBound, mouseupBound);
    this.canvas.addEventListener('mousemove', translateBound);
  }
  this.canvas.addEventListener('mouseup', mouseupBound);
};

CanvasDemo.prototype.drag = function(shape, event) {
  
  if (event.which === 1 && mousePointInitial) {
    var mousePoint = this.canvas.relMouseCoords(event);
    var deltaX = mousePoint.x - mousePointInitial.x;
    var deltaY = mousePoint.y - mousePointInitial.y;
    shape.x = shapePointInitial.x + deltaX;
    shape.y = shapePointInitial.y + deltaY;
    this.draw();
  } else {
    if (_resetBound) {
      _resetBound();
    }
  }
}

CanvasDemo.prototype.translate = function(event) {
  if (event.which === 1 && mousePointInitial) {
    var mousePoint = this.canvas.relMouseCoords(event);
    this.translateX = translateInitial.x + (mousePoint.x - mousePointInitial.x) / this.scale;
    this.translateY = translateInitial.y + (mousePoint.y - mousePointInitial.y) / this.scale;
    this.draw();
  } else {
    if (_resetBound) {
      _resetBound();
    }
  }
};

CanvasDemo.prototype.mouseup = function(event) {
  _resetBound();
}

function _reset(dragBound, mouseupBound) {
  mousePointInitial = null;
  shapePointInitial = null;
  translateInitial = null;
  this.canvas.removeEventListener('mousemove', dragBound);
  this.canvas.removeEventListener('mouseup', mouseupBound);
};


CanvasDemo.prototype.draw = function() {
  this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
  this.ctx.translate(this.translateX * this.scale, this.translateY * this.scale);
  for(var i = 0; i < this.shapes.length; i++) {
    var shape = this.shapes[i];
    this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
    this.ctx.fillRect.apply(this.ctx, shape.getDimensions(this.scale));
    // this.ctx.strokeRect(45,45,60,60);
  }
  this.ctx.translate(-this.translateX * this.scale, -this.translateY * this.scale);
};

CanvasDemo.prototype.getShapeinBounds = function(point) {
  // var pointX = point.x - this.translateX;
  var pointX = point.x;
  // var pointY = point.y - this.translateY;
  var pointY = point.y;
  var shape = this.rect;
  for(var i = 0; i < this.shapes.length; i++) {
    shape = this.shapes[i];
    if ( (shape.x <= pointX) && (pointX <= shape.x + shape.width) && (shape.y <= pointY) && (pointY <= shape.y + shape.height) ){
      return shape;
    }
  }
  return null;
};

CanvasDemo.prototype.resizeCanvas = function() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.draw();
};
},{}]},{},[2])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY2FudmFzLmpzIiwic3JjL21haW4vbWFpbi5qcyIsInNyYy9uYXYvbmF2LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgQ2FudmFzRGVtbyA9IHJlcXVpcmUoJy4vbmF2L25hdi5qcycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuXG4gIHdpbmRvdy5vbmxvYWQgPSBydW47XG5cbiAgZnVuY3Rpb24gcnVuKCkge1xuICAgdmFyIGNkID0gbmV3IENhbnZhc0RlbW8oKTtcbiAgfTtcblxuICBIVE1MQ2FudmFzRWxlbWVudC5wcm90b3R5cGUucmVsTW91c2VDb29yZHMgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICB2YXIgdG90YWxPZmZzZXRYID0gMDtcbiAgICB2YXIgdG90YWxPZmZzZXRZID0gMDtcbiAgICB2YXIgY2FudmFzWCA9IDA7XG4gICAgdmFyIGNhbnZhc1kgPSAwO1xuICAgIHZhciBjdXJyZW50RWxlbWVudCA9IHRoaXM7XG5cbiAgICBkbyB7XG4gICAgICAgIHRvdGFsT2Zmc2V0WCArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRMZWZ0O1xuICAgICAgICB0b3RhbE9mZnNldFkgKz0gY3VycmVudEVsZW1lbnQub2Zmc2V0VG9wO1xuICAgIH1cbiAgICB3aGlsZSAoY3VycmVudEVsZW1lbnQgPSBjdXJyZW50RWxlbWVudC5vZmZzZXRQYXJlbnQpXG5cbiAgICBjYW52YXNYID0gZXZlbnQucGFnZVggLSB0b3RhbE9mZnNldFg7XG4gICAgY2FudmFzWSA9IGV2ZW50LnBhZ2VZIC0gdG90YWxPZmZzZXRZO1xuXG4gICAgLy8gRml4IGZvciB2YXJpYWJsZSBjYW52YXMgd2lkdGhcbiAgICBjYW52YXNYID0gTWF0aC5yb3VuZCggY2FudmFzWCAqICh0aGlzLndpZHRoIC8gdGhpcy5vZmZzZXRXaWR0aCkgKTtcbiAgICBjYW52YXNZID0gTWF0aC5yb3VuZCggY2FudmFzWSAqICh0aGlzLmhlaWdodCAvIHRoaXMub2Zmc2V0SGVpZ2h0KSApO1xuXG4gICAgcmV0dXJuIHt4OmNhbnZhc1gsIHk6Y2FudmFzWX1cbiAgfVxufTtcbiIsInZhciBjYW52YXMgPSByZXF1aXJlKCcuLi9jYW52YXMuanMnKTtcblxuY2FudmFzKCk7XG5cbi8vIGNvbnNvbGUubG9nKCd0ZXN0aW5nIHRlc3RpbmcnKTtcbiIsIlxubW9kdWxlLmV4cG9ydHMgPSBDYW52YXNEZW1vO1xuXG4vLyBmdW5jdGlvbiBodygpIHtcbi8vICAgdmFyIHRlc3QgPSAnaGVsbG8gd29ybGQgd2F0Y2gnXG4vLyAgIGNvbnNvbGUubG9nKHRlc3QpO1xuLy8gICByZXR1cm4gdGVzdDtcbi8vIH07XG5cbnZhciBSZWN0ID0gZnVuY3Rpb24oeCwgeSwgd2lkdGgsIGhlaWdodCkge1xuICB0aGlzLnggPSB4O1xuICB0aGlzLnkgPSB5O1xuICB0aGlzLndpZHRoID0gd2lkdGg7XG4gIHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xufVxuXG5SZWN0LnByb3RvdHlwZS5nZXREaW1lbnNpb25zID0gZnVuY3Rpb24oc2NhbGUpIHtcbiAgdmFyIHgsIHksIHdpZHRoLCBoZWlnaHQ7XG4gIHggPSB0aGlzLnggKiBzY2FsZTtcbiAgeSA9IHRoaXMueSAqIHNjYWxlO1xuICB3aWR0aCA9IHRoaXMud2lkdGggKiBzY2FsZTtcbiAgaGVpZ2h0ID0gdGhpcy5oZWlnaHQgKiBzY2FsZTtcbiAgLy8gcmV0dXJuIFt0aGlzLngsIHRoaXMueSwgdGhpcy53aWR0aCwgdGhpcy5oZWlnaHRdO1xuICAvLyBjb25zb2xlLmxvZyh4LHksc2NhbGUpO1xuICByZXR1cm4gW3gsIHksIHdpZHRoLCBoZWlnaHRdO1xufTtcblxuLy8gdmFyIENhbnZhc0RlbW8gPSBmdW5jdGlvbigpIHtcbmZ1bmN0aW9uIENhbnZhc0RlbW8oKSB7XG4gIHRoaXMuY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhbnZhcycpO1xuICB0aGlzLnNoYXBlcyA9IFtdO1xuICB0aGlzLnRyYW5zbGF0ZVggPSAwO1xuICB0aGlzLnRyYW5zbGF0ZVkgPSAwO1xuICB0aGlzLnNjYWxlID0gMTtcblxuICBpZiAoIHRoaXMuY2FudmFzLmdldENvbnRleHQgKSB7XG4gICAgdGhpcy5zaGFwZXMucHVzaCggbmV3IFJlY3QoMjUsMjUsMTAwLDEwMCkgKTtcbiAgICB0aGlzLnNoYXBlcy5wdXNoKCBuZXcgUmVjdCgxMjUsMTI1LDIwMCwyMDApICk7XG4gICAgdGhpcy5jdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgICB0aGlzLnJlc2l6ZUNhbnZhcygpO1xuICAgIHdpbmRvdy5vbnJlc2l6ZSA9IHRoaXMucmVzaXplQ2FudmFzLmJpbmQodGhpcyk7XG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVycygpO1xuICAgIHRoaXMuZHJhdygpO1xuICB9XG59XG5cbnZhciBtb3VzZVBvaW50SW5pdGlhbCA9IHt9O1xudmFyIHNoYXBlUG9pbnRJbml0aWFsID0ge307XG52YXIgdHJhbnNsYXRlSW5pdGlhbCA9IHt9O1xudmFyIGRyYWdCb3VuZDtcbnZhciBtb3VzZXVwQm91bmQ7XG52YXIgX3Jlc2V0Qm91bmQ7XG5cbkNhbnZhc0RlbW8ucHJvdG90eXBlLmFkZEV2ZW50TGlzdGVuZXJzID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHRoaXMubW91c2Vkb3duLmJpbmQodGhpcykpO1xuICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXdoZWVsJywgdGhpcy5tb3VzZXdoZWVsLmJpbmQodGhpcykpO1xufTtcblxuQ2FudmFzRGVtby5wcm90b3R5cGUubW91c2V3aGVlbCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gIHZhciBtb3VzZSA9IHRoaXMuY2FudmFzLnJlbE1vdXNlQ29vcmRzKGV2ZW50KTtcbiAgdmFyIHNjYWxlUHJldiA9IHRoaXMuc2NhbGU7XG5cbiAgaWYgKGV2ZW50LndoZWVsRGVsdGFZIDwgMCkge1xuICAgIHRoaXMuc2NhbGUgPSB0aGlzLnNjYWxlICogMS4wNTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnNjYWxlID0gdGhpcy5zY2FsZSAqIDAuOTU7XG4gIH1cblxuICB0aGlzLnRyYW5zbGF0ZVggPSB0aGlzLnRyYW5zbGF0ZVggLSBfZ2V0VHJhbnNsYXRlRGVsdGEobW91c2UueCwgc2NhbGVQcmV2LCB0aGlzLnNjYWxlKTtcbiAgdGhpcy50cmFuc2xhdGVZID0gdGhpcy50cmFuc2xhdGVZIC0gX2dldFRyYW5zbGF0ZURlbHRhKG1vdXNlLnksIHNjYWxlUHJldiwgdGhpcy5zY2FsZSk7XG5cbiAgZnVuY3Rpb24gX2dldFRyYW5zbGF0ZURlbHRhKHgsIHNjYWxlUHJldiwgc2NhbGVOZXcpIHtcbiAgICB2YXIgdHJhbnNsYXRlRGVsdGEgPSAoeCAvIHNjYWxlUHJldiAqIHNjYWxlTmV3IC0geCkgLyBzY2FsZU5ldztcbiAgICByZXR1cm4gdHJhbnNsYXRlRGVsdGE7XG4gIH1cblxuICBjb25zb2xlLmxvZyh0aGlzLnNjYWxlKTtcbiAgdGhpcy5kcmF3KCk7XG59O1xuXG5DYW52YXNEZW1vLnByb3RvdHlwZS5tb3VzZWRvd24gPSBmdW5jdGlvbihldmVudCkge1xuICB2YXIgbW91c2UgPSB0aGlzLmNhbnZhcy5yZWxNb3VzZUNvb3JkcyhldmVudCk7XG4gIHZhciBwb2ludCA9IHt9O1xuICBwb2ludC54ID0gbW91c2UueCAvIHRoaXMuc2NhbGUgLSB0aGlzLnRyYW5zbGF0ZVg7XG4gIHBvaW50LnkgPSBtb3VzZS55IC8gdGhpcy5zY2FsZSAtIHRoaXMudHJhbnNsYXRlWTtcblxuICB2YXIgc2hhcGUgPSB0aGlzLmdldFNoYXBlaW5Cb3VuZHMocG9pbnQpO1xuICBtb3VzZVBvaW50SW5pdGlhbCA9IHBvaW50O1xuICBtb3VzZXVwQm91bmQgPSB0aGlzLm1vdXNldXAuYmluZCh0aGlzKTtcbiAgY29uc29sZS5sb2coc2hhcGUpO1xuICBpZiAoIHNoYXBlICkge1xuICAgIHNoYXBlUG9pbnRJbml0aWFsID0ge3g6IHNoYXBlLngsIHk6IHNoYXBlLnl9O1xuICAgIGRyYWdCb3VuZCA9IHRoaXMuZHJhZy5iaW5kKHRoaXMsIHNoYXBlKTtcbiAgICBfcmVzZXRCb3VuZCA9IF9yZXNldC5iaW5kKHRoaXMsIGRyYWdCb3VuZCwgbW91c2V1cEJvdW5kKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBkcmFnQm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHRyYW5zbGF0ZUluaXRpYWwgPSB7eDogdGhpcy50cmFuc2xhdGVYLCB5OiB0aGlzLnRyYW5zbGF0ZVl9O1xuICAgIHRyYW5zbGF0ZUJvdW5kID0gdGhpcy50cmFuc2xhdGUuYmluZCh0aGlzKTtcbiAgICBfcmVzZXRCb3VuZCA9IF9yZXNldC5iaW5kKHRoaXMsIHRyYW5zbGF0ZUJvdW5kLCBtb3VzZXVwQm91bmQpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRyYW5zbGF0ZUJvdW5kKTtcbiAgfVxuICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2V1cEJvdW5kKTtcbn07XG5cbkNhbnZhc0RlbW8ucHJvdG90eXBlLmRyYWcgPSBmdW5jdGlvbihzaGFwZSwgZXZlbnQpIHtcbiAgXG4gIGlmIChldmVudC53aGljaCA9PT0gMSAmJiBtb3VzZVBvaW50SW5pdGlhbCkge1xuICAgIHZhciBtb3VzZVBvaW50ID0gdGhpcy5jYW52YXMucmVsTW91c2VDb29yZHMoZXZlbnQpO1xuICAgIHZhciBkZWx0YVggPSBtb3VzZVBvaW50LnggLSBtb3VzZVBvaW50SW5pdGlhbC54O1xuICAgIHZhciBkZWx0YVkgPSBtb3VzZVBvaW50LnkgLSBtb3VzZVBvaW50SW5pdGlhbC55O1xuICAgIHNoYXBlLnggPSBzaGFwZVBvaW50SW5pdGlhbC54ICsgZGVsdGFYO1xuICAgIHNoYXBlLnkgPSBzaGFwZVBvaW50SW5pdGlhbC55ICsgZGVsdGFZO1xuICAgIHRoaXMuZHJhdygpO1xuICB9IGVsc2Uge1xuICAgIGlmIChfcmVzZXRCb3VuZCkge1xuICAgICAgX3Jlc2V0Qm91bmQoKTtcbiAgICB9XG4gIH1cbn1cblxuQ2FudmFzRGVtby5wcm90b3R5cGUudHJhbnNsYXRlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgaWYgKGV2ZW50LndoaWNoID09PSAxICYmIG1vdXNlUG9pbnRJbml0aWFsKSB7XG4gICAgdmFyIG1vdXNlUG9pbnQgPSB0aGlzLmNhbnZhcy5yZWxNb3VzZUNvb3JkcyhldmVudCk7XG4gICAgdGhpcy50cmFuc2xhdGVYID0gdHJhbnNsYXRlSW5pdGlhbC54ICsgKG1vdXNlUG9pbnQueCAtIG1vdXNlUG9pbnRJbml0aWFsLngpIC8gdGhpcy5zY2FsZTtcbiAgICB0aGlzLnRyYW5zbGF0ZVkgPSB0cmFuc2xhdGVJbml0aWFsLnkgKyAobW91c2VQb2ludC55IC0gbW91c2VQb2ludEluaXRpYWwueSkgLyB0aGlzLnNjYWxlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9IGVsc2Uge1xuICAgIGlmIChfcmVzZXRCb3VuZCkge1xuICAgICAgX3Jlc2V0Qm91bmQoKTtcbiAgICB9XG4gIH1cbn07XG5cbkNhbnZhc0RlbW8ucHJvdG90eXBlLm1vdXNldXAgPSBmdW5jdGlvbihldmVudCkge1xuICBfcmVzZXRCb3VuZCgpO1xufVxuXG5mdW5jdGlvbiBfcmVzZXQoZHJhZ0JvdW5kLCBtb3VzZXVwQm91bmQpIHtcbiAgbW91c2VQb2ludEluaXRpYWwgPSBudWxsO1xuICBzaGFwZVBvaW50SW5pdGlhbCA9IG51bGw7XG4gIHRyYW5zbGF0ZUluaXRpYWwgPSBudWxsO1xuICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBkcmFnQm91bmQpO1xuICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2V1cEJvdW5kKTtcbn07XG5cblxuQ2FudmFzRGVtby5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmN0eC5jbGVhclJlY3QoMCwwLHRoaXMuY2FudmFzLndpZHRoLCB0aGlzLmNhbnZhcy5oZWlnaHQpO1xuICB0aGlzLmN0eC50cmFuc2xhdGUodGhpcy50cmFuc2xhdGVYICogdGhpcy5zY2FsZSwgdGhpcy50cmFuc2xhdGVZICogdGhpcy5zY2FsZSk7XG4gIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnNoYXBlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzaGFwZSA9IHRoaXMuc2hhcGVzW2ldO1xuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDIwMCwwLDAsMC41KSc7XG4gICAgdGhpcy5jdHguZmlsbFJlY3QuYXBwbHkodGhpcy5jdHgsIHNoYXBlLmdldERpbWVuc2lvbnModGhpcy5zY2FsZSkpO1xuICAgIC8vIHRoaXMuY3R4LnN0cm9rZVJlY3QoNDUsNDUsNjAsNjApO1xuICB9XG4gIHRoaXMuY3R4LnRyYW5zbGF0ZSgtdGhpcy50cmFuc2xhdGVYICogdGhpcy5zY2FsZSwgLXRoaXMudHJhbnNsYXRlWSAqIHRoaXMuc2NhbGUpO1xufTtcblxuQ2FudmFzRGVtby5wcm90b3R5cGUuZ2V0U2hhcGVpbkJvdW5kcyA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gIC8vIHZhciBwb2ludFggPSBwb2ludC54IC0gdGhpcy50cmFuc2xhdGVYO1xuICB2YXIgcG9pbnRYID0gcG9pbnQueDtcbiAgLy8gdmFyIHBvaW50WSA9IHBvaW50LnkgLSB0aGlzLnRyYW5zbGF0ZVk7XG4gIHZhciBwb2ludFkgPSBwb2ludC55O1xuICB2YXIgc2hhcGUgPSB0aGlzLnJlY3Q7XG4gIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnNoYXBlcy5sZW5ndGg7IGkrKykge1xuICAgIHNoYXBlID0gdGhpcy5zaGFwZXNbaV07XG4gICAgaWYgKCAoc2hhcGUueCA8PSBwb2ludFgpICYmIChwb2ludFggPD0gc2hhcGUueCArIHNoYXBlLndpZHRoKSAmJiAoc2hhcGUueSA8PSBwb2ludFkpICYmIChwb2ludFkgPD0gc2hhcGUueSArIHNoYXBlLmhlaWdodCkgKXtcbiAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5DYW52YXNEZW1vLnByb3RvdHlwZS5yZXNpemVDYW52YXMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNhbnZhcy53aWR0aCAgPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gICAgdGhpcy5kcmF3KCk7XG59OyJdfQ==
