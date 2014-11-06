(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

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

Rect.prototype.getDimensions = function() {
  return [this.x, this.y, this.width, this.height];
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
  console.log("hello world: ");
  var point = this.canvas.relMouseCoords(event);
  var scalePrev = this.scale;

  if (event.wheelDeltaY < 0) {
    this.scale = this.scale * 1.05;
  } else {
    this.scale = this.scale * 0.95;
  }
  console.log(this.scale);
  // this.draw();
};

CanvasDemo.prototype.mousedown = function(event) {
  var point = this.canvas.relMouseCoords(event);
  var shape = this.getShapeinBounds(point);
  mousePointInitial = point;
  mouseupBound = this.mouseup.bind(this);
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
    this.translateX = translateInitial.x + mousePoint.x - mousePointInitial.x;
    this.translateY = translateInitial.y + mousePoint.y - mousePointInitial.y;
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
  this.ctx.translate(this.translateX, this.translateY);
  for(var i = 0; i < this.shapes.length; i++) {
    var shape = this.shapes[i];
    this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
    this.ctx.fillRect.apply(this.ctx, shape.getDimensions());
    // this.ctx.strokeRect(45,45,60,60);
  }
  this.ctx.translate(-this.translateX, -this.translateY);
};

CanvasDemo.prototype.getShapeinBounds = function(point) {
  var pointX = point.x - this.translateX;
  var pointY = point.y - this.translateY;
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
},{}],2:[function(require,module,exports){
var hw = require('../../nav.js')

describe('ModuleName', function() {
  describe('Method name', function() {
    it('should ', function() {
      hw();
    });
  });
});
},{"../../nav.js":1}]},{},[2]);
