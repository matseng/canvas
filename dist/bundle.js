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

  this.draw();
};

CanvasDemo.prototype.mousedown = function(event) {
  var mouse = this.canvas.relMouseCoords(event);
  mousePointInitial = mouse;

  var point = {};
  point.x = mouse.x / this.scale - this.translateX;
  point.y = mouse.y / this.scale - this.translateY;
  var shape = this.getShapeinBounds(point);
  
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
    var deltaX = (mousePoint.x - mousePointInitial.x) / this.scale;
    var deltaY = (mousePoint.y - mousePointInitial.y) / this.scale;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvY2FudmFzLmpzIiwic3JjL21haW4vbWFpbi5qcyIsInNyYy9uYXYvbmF2LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBDYW52YXNEZW1vID0gcmVxdWlyZSgnLi9uYXYvbmF2LmpzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG5cbiAgd2luZG93Lm9ubG9hZCA9IHJ1bjtcblxuICBmdW5jdGlvbiBydW4oKSB7XG4gICB2YXIgY2QgPSBuZXcgQ2FudmFzRGVtbygpO1xuICB9O1xuXG4gIEhUTUxDYW52YXNFbGVtZW50LnByb3RvdHlwZS5yZWxNb3VzZUNvb3JkcyA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgIHZhciB0b3RhbE9mZnNldFggPSAwO1xuICAgIHZhciB0b3RhbE9mZnNldFkgPSAwO1xuICAgIHZhciBjYW52YXNYID0gMDtcbiAgICB2YXIgY2FudmFzWSA9IDA7XG4gICAgdmFyIGN1cnJlbnRFbGVtZW50ID0gdGhpcztcblxuICAgIGRvIHtcbiAgICAgICAgdG90YWxPZmZzZXRYICs9IGN1cnJlbnRFbGVtZW50Lm9mZnNldExlZnQ7XG4gICAgICAgIHRvdGFsT2Zmc2V0WSArPSBjdXJyZW50RWxlbWVudC5vZmZzZXRUb3A7XG4gICAgfVxuICAgIHdoaWxlIChjdXJyZW50RWxlbWVudCA9IGN1cnJlbnRFbGVtZW50Lm9mZnNldFBhcmVudClcblxuICAgIGNhbnZhc1ggPSBldmVudC5wYWdlWCAtIHRvdGFsT2Zmc2V0WDtcbiAgICBjYW52YXNZID0gZXZlbnQucGFnZVkgLSB0b3RhbE9mZnNldFk7XG5cbiAgICAvLyBGaXggZm9yIHZhcmlhYmxlIGNhbnZhcyB3aWR0aFxuICAgIGNhbnZhc1ggPSBNYXRoLnJvdW5kKCBjYW52YXNYICogKHRoaXMud2lkdGggLyB0aGlzLm9mZnNldFdpZHRoKSApO1xuICAgIGNhbnZhc1kgPSBNYXRoLnJvdW5kKCBjYW52YXNZICogKHRoaXMuaGVpZ2h0IC8gdGhpcy5vZmZzZXRIZWlnaHQpICk7XG5cbiAgICByZXR1cm4ge3g6Y2FudmFzWCwgeTpjYW52YXNZfVxuICB9XG59O1xuIiwidmFyIGNhbnZhcyA9IHJlcXVpcmUoJy4uL2NhbnZhcy5qcycpO1xuXG5jYW52YXMoKTtcblxuLy8gY29uc29sZS5sb2coJ3Rlc3RpbmcgdGVzdGluZycpO1xuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IENhbnZhc0RlbW87XG5cbi8vIGZ1bmN0aW9uIGh3KCkge1xuLy8gICB2YXIgdGVzdCA9ICdoZWxsbyB3b3JsZCB3YXRjaCdcbi8vICAgY29uc29sZS5sb2codGVzdCk7XG4vLyAgIHJldHVybiB0ZXN0O1xuLy8gfTtcblxudmFyIFJlY3QgPSBmdW5jdGlvbih4LCB5LCB3aWR0aCwgaGVpZ2h0KSB7XG4gIHRoaXMueCA9IHg7XG4gIHRoaXMueSA9IHk7XG4gIHRoaXMud2lkdGggPSB3aWR0aDtcbiAgdGhpcy5oZWlnaHQgPSBoZWlnaHQ7XG59XG5cblJlY3QucHJvdG90eXBlLmdldERpbWVuc2lvbnMgPSBmdW5jdGlvbihzY2FsZSkge1xuICB2YXIgeCwgeSwgd2lkdGgsIGhlaWdodDtcbiAgeCA9IHRoaXMueCAqIHNjYWxlO1xuICB5ID0gdGhpcy55ICogc2NhbGU7XG4gIHdpZHRoID0gdGhpcy53aWR0aCAqIHNjYWxlO1xuICBoZWlnaHQgPSB0aGlzLmhlaWdodCAqIHNjYWxlO1xuICAvLyByZXR1cm4gW3RoaXMueCwgdGhpcy55LCB0aGlzLndpZHRoLCB0aGlzLmhlaWdodF07XG4gIC8vIGNvbnNvbGUubG9nKHgseSxzY2FsZSk7XG4gIHJldHVybiBbeCwgeSwgd2lkdGgsIGhlaWdodF07XG59O1xuXG4vLyB2YXIgQ2FudmFzRGVtbyA9IGZ1bmN0aW9uKCkge1xuZnVuY3Rpb24gQ2FudmFzRGVtbygpIHtcbiAgdGhpcy5jYW52YXMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyk7XG4gIHRoaXMuc2hhcGVzID0gW107XG4gIHRoaXMudHJhbnNsYXRlWCA9IDA7XG4gIHRoaXMudHJhbnNsYXRlWSA9IDA7XG4gIHRoaXMuc2NhbGUgPSAxO1xuXG4gIGlmICggdGhpcy5jYW52YXMuZ2V0Q29udGV4dCApIHtcbiAgICB0aGlzLnNoYXBlcy5wdXNoKCBuZXcgUmVjdCgyNSwyNSwxMDAsMTAwKSApO1xuICAgIHRoaXMuc2hhcGVzLnB1c2goIG5ldyBSZWN0KDEyNSwxMjUsMjAwLDIwMCkgKTtcbiAgICB0aGlzLmN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcpO1xuICAgIHRoaXMucmVzaXplQ2FudmFzKCk7XG4gICAgd2luZG93Lm9ucmVzaXplID0gdGhpcy5yZXNpemVDYW52YXMuYmluZCh0aGlzKTtcbiAgICB0aGlzLmFkZEV2ZW50TGlzdGVuZXJzKCk7XG4gICAgdGhpcy5kcmF3KCk7XG4gIH1cbn1cblxudmFyIG1vdXNlUG9pbnRJbml0aWFsID0ge307XG52YXIgc2hhcGVQb2ludEluaXRpYWwgPSB7fTtcbnZhciB0cmFuc2xhdGVJbml0aWFsID0ge307XG52YXIgZHJhZ0JvdW5kO1xudmFyIG1vdXNldXBCb3VuZDtcbnZhciBfcmVzZXRCb3VuZDtcblxuQ2FudmFzRGVtby5wcm90b3R5cGUuYWRkRXZlbnRMaXN0ZW5lcnMgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5jYW52YXMuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5tb3VzZWRvd24uYmluZCh0aGlzKSk7XG4gIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNld2hlZWwnLCB0aGlzLm1vdXNld2hlZWwuYmluZCh0aGlzKSk7XG59O1xuXG5DYW52YXNEZW1vLnByb3RvdHlwZS5tb3VzZXdoZWVsID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgdmFyIG1vdXNlID0gdGhpcy5jYW52YXMucmVsTW91c2VDb29yZHMoZXZlbnQpO1xuICB2YXIgc2NhbGVQcmV2ID0gdGhpcy5zY2FsZTtcblxuICBpZiAoZXZlbnQud2hlZWxEZWx0YVkgPCAwKSB7XG4gICAgdGhpcy5zY2FsZSA9IHRoaXMuc2NhbGUgKiAxLjA1O1xuICB9IGVsc2Uge1xuICAgIHRoaXMuc2NhbGUgPSB0aGlzLnNjYWxlICogMC45NTtcbiAgfVxuXG4gIHRoaXMudHJhbnNsYXRlWCA9IHRoaXMudHJhbnNsYXRlWCAtIF9nZXRUcmFuc2xhdGVEZWx0YShtb3VzZS54LCBzY2FsZVByZXYsIHRoaXMuc2NhbGUpO1xuICB0aGlzLnRyYW5zbGF0ZVkgPSB0aGlzLnRyYW5zbGF0ZVkgLSBfZ2V0VHJhbnNsYXRlRGVsdGEobW91c2UueSwgc2NhbGVQcmV2LCB0aGlzLnNjYWxlKTtcblxuICBmdW5jdGlvbiBfZ2V0VHJhbnNsYXRlRGVsdGEoeCwgc2NhbGVQcmV2LCBzY2FsZU5ldykge1xuICAgIHZhciB0cmFuc2xhdGVEZWx0YSA9ICh4IC8gc2NhbGVQcmV2ICogc2NhbGVOZXcgLSB4KSAvIHNjYWxlTmV3O1xuICAgIHJldHVybiB0cmFuc2xhdGVEZWx0YTtcbiAgfVxuXG4gIHRoaXMuZHJhdygpO1xufTtcblxuQ2FudmFzRGVtby5wcm90b3R5cGUubW91c2Vkb3duID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgdmFyIG1vdXNlID0gdGhpcy5jYW52YXMucmVsTW91c2VDb29yZHMoZXZlbnQpO1xuICBtb3VzZVBvaW50SW5pdGlhbCA9IG1vdXNlO1xuXG4gIHZhciBwb2ludCA9IHt9O1xuICBwb2ludC54ID0gbW91c2UueCAvIHRoaXMuc2NhbGUgLSB0aGlzLnRyYW5zbGF0ZVg7XG4gIHBvaW50LnkgPSBtb3VzZS55IC8gdGhpcy5zY2FsZSAtIHRoaXMudHJhbnNsYXRlWTtcbiAgdmFyIHNoYXBlID0gdGhpcy5nZXRTaGFwZWluQm91bmRzKHBvaW50KTtcbiAgXG4gIG1vdXNldXBCb3VuZCA9IHRoaXMubW91c2V1cC5iaW5kKHRoaXMpO1xuICBcbiAgY29uc29sZS5sb2coc2hhcGUpO1xuICBpZiAoIHNoYXBlICkge1xuICAgIHNoYXBlUG9pbnRJbml0aWFsID0ge3g6IHNoYXBlLngsIHk6IHNoYXBlLnl9O1xuICAgIGRyYWdCb3VuZCA9IHRoaXMuZHJhZy5iaW5kKHRoaXMsIHNoYXBlKTtcbiAgICBfcmVzZXRCb3VuZCA9IF9yZXNldC5iaW5kKHRoaXMsIGRyYWdCb3VuZCwgbW91c2V1cEJvdW5kKTtcbiAgICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBkcmFnQm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHRyYW5zbGF0ZUluaXRpYWwgPSB7eDogdGhpcy50cmFuc2xhdGVYLCB5OiB0aGlzLnRyYW5zbGF0ZVl9O1xuICAgIHRyYW5zbGF0ZUJvdW5kID0gdGhpcy50cmFuc2xhdGUuYmluZCh0aGlzKTtcbiAgICBfcmVzZXRCb3VuZCA9IF9yZXNldC5iaW5kKHRoaXMsIHRyYW5zbGF0ZUJvdW5kLCBtb3VzZXVwQm91bmQpO1xuICAgIHRoaXMuY2FudmFzLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRyYW5zbGF0ZUJvdW5kKTtcbiAgfVxuICB0aGlzLmNhbnZhcy5hZGRFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2V1cEJvdW5kKTtcbn07XG5cbkNhbnZhc0RlbW8ucHJvdG90eXBlLmRyYWcgPSBmdW5jdGlvbihzaGFwZSwgZXZlbnQpIHtcbiAgXG4gIGlmIChldmVudC53aGljaCA9PT0gMSAmJiBtb3VzZVBvaW50SW5pdGlhbCkge1xuICAgIHZhciBtb3VzZVBvaW50ID0gdGhpcy5jYW52YXMucmVsTW91c2VDb29yZHMoZXZlbnQpO1xuICAgIHZhciBkZWx0YVggPSAobW91c2VQb2ludC54IC0gbW91c2VQb2ludEluaXRpYWwueCkgLyB0aGlzLnNjYWxlO1xuICAgIHZhciBkZWx0YVkgPSAobW91c2VQb2ludC55IC0gbW91c2VQb2ludEluaXRpYWwueSkgLyB0aGlzLnNjYWxlO1xuICAgIHNoYXBlLnggPSBzaGFwZVBvaW50SW5pdGlhbC54ICsgZGVsdGFYO1xuICAgIHNoYXBlLnkgPSBzaGFwZVBvaW50SW5pdGlhbC55ICsgZGVsdGFZO1xuICAgIHRoaXMuZHJhdygpO1xuICB9IGVsc2Uge1xuICAgIGlmIChfcmVzZXRCb3VuZCkge1xuICAgICAgX3Jlc2V0Qm91bmQoKTtcbiAgICB9XG4gIH1cbn1cblxuQ2FudmFzRGVtby5wcm90b3R5cGUudHJhbnNsYXRlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgaWYgKGV2ZW50LndoaWNoID09PSAxICYmIG1vdXNlUG9pbnRJbml0aWFsKSB7XG4gICAgdmFyIG1vdXNlUG9pbnQgPSB0aGlzLmNhbnZhcy5yZWxNb3VzZUNvb3JkcyhldmVudCk7XG4gICAgdGhpcy50cmFuc2xhdGVYID0gdHJhbnNsYXRlSW5pdGlhbC54ICsgKG1vdXNlUG9pbnQueCAtIG1vdXNlUG9pbnRJbml0aWFsLngpIC8gdGhpcy5zY2FsZTtcbiAgICB0aGlzLnRyYW5zbGF0ZVkgPSB0cmFuc2xhdGVJbml0aWFsLnkgKyAobW91c2VQb2ludC55IC0gbW91c2VQb2ludEluaXRpYWwueSkgLyB0aGlzLnNjYWxlO1xuICAgIHRoaXMuZHJhdygpO1xuICB9IGVsc2Uge1xuICAgIGlmIChfcmVzZXRCb3VuZCkge1xuICAgICAgX3Jlc2V0Qm91bmQoKTtcbiAgICB9XG4gIH1cbn07XG5cbkNhbnZhc0RlbW8ucHJvdG90eXBlLm1vdXNldXAgPSBmdW5jdGlvbihldmVudCkge1xuICBfcmVzZXRCb3VuZCgpO1xufVxuXG5mdW5jdGlvbiBfcmVzZXQoZHJhZ0JvdW5kLCBtb3VzZXVwQm91bmQpIHtcbiAgbW91c2VQb2ludEluaXRpYWwgPSBudWxsO1xuICBzaGFwZVBvaW50SW5pdGlhbCA9IG51bGw7XG4gIHRyYW5zbGF0ZUluaXRpYWwgPSBudWxsO1xuICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZW1vdmUnLCBkcmFnQm91bmQpO1xuICB0aGlzLmNhbnZhcy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXVwJywgbW91c2V1cEJvdW5kKTtcbn07XG5cblxuQ2FudmFzRGVtby5wcm90b3R5cGUuZHJhdyA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLmN0eC5jbGVhclJlY3QoMCwwLHRoaXMuY2FudmFzLndpZHRoLCB0aGlzLmNhbnZhcy5oZWlnaHQpO1xuICB0aGlzLmN0eC50cmFuc2xhdGUodGhpcy50cmFuc2xhdGVYICogdGhpcy5zY2FsZSwgdGhpcy50cmFuc2xhdGVZICogdGhpcy5zY2FsZSk7XG4gIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnNoYXBlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBzaGFwZSA9IHRoaXMuc2hhcGVzW2ldO1xuICAgIHRoaXMuY3R4LmZpbGxTdHlsZSA9ICdyZ2JhKDIwMCwwLDAsMC41KSc7XG4gICAgdGhpcy5jdHguZmlsbFJlY3QuYXBwbHkodGhpcy5jdHgsIHNoYXBlLmdldERpbWVuc2lvbnModGhpcy5zY2FsZSkpO1xuICAgIC8vIHRoaXMuY3R4LnN0cm9rZVJlY3QoNDUsNDUsNjAsNjApO1xuICB9XG4gIHRoaXMuY3R4LnRyYW5zbGF0ZSgtdGhpcy50cmFuc2xhdGVYICogdGhpcy5zY2FsZSwgLXRoaXMudHJhbnNsYXRlWSAqIHRoaXMuc2NhbGUpO1xufTtcblxuQ2FudmFzRGVtby5wcm90b3R5cGUuZ2V0U2hhcGVpbkJvdW5kcyA9IGZ1bmN0aW9uKHBvaW50KSB7XG4gIC8vIHZhciBwb2ludFggPSBwb2ludC54IC0gdGhpcy50cmFuc2xhdGVYO1xuICB2YXIgcG9pbnRYID0gcG9pbnQueDtcbiAgLy8gdmFyIHBvaW50WSA9IHBvaW50LnkgLSB0aGlzLnRyYW5zbGF0ZVk7XG4gIHZhciBwb2ludFkgPSBwb2ludC55O1xuICB2YXIgc2hhcGUgPSB0aGlzLnJlY3Q7XG4gIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLnNoYXBlcy5sZW5ndGg7IGkrKykge1xuICAgIHNoYXBlID0gdGhpcy5zaGFwZXNbaV07XG4gICAgaWYgKCAoc2hhcGUueCA8PSBwb2ludFgpICYmIChwb2ludFggPD0gc2hhcGUueCArIHNoYXBlLndpZHRoKSAmJiAoc2hhcGUueSA8PSBwb2ludFkpICYmIChwb2ludFkgPD0gc2hhcGUueSArIHNoYXBlLmhlaWdodCkgKXtcbiAgICAgIHJldHVybiBzaGFwZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5DYW52YXNEZW1vLnByb3RvdHlwZS5yZXNpemVDYW52YXMgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNhbnZhcy53aWR0aCAgPSB3aW5kb3cuaW5uZXJXaWR0aDtcbiAgICB0aGlzLmNhbnZhcy5oZWlnaHQgPSB3aW5kb3cuaW5uZXJIZWlnaHQ7XG4gICAgdGhpcy5kcmF3KCk7XG59OyJdfQ==
