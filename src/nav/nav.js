var Hammer = require('hammerjs');


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
  this.hammer;

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
  // this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
  this.canvas.addEventListener('mousewheel', this.mousewheel.bind(this));
  this.addHammerEventListeners();
};

CanvasDemo.prototype.addHammerEventListeners = function() {
  this.hammer = new Hammer.Manager(this.canvas);
  this.hammer.add(new Hammer.Pan({threshold:0}));
  this.hammer.on('panstart', this.mousedown.bind(this));
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
  event = event.srcEvent;
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
    // this.canvas.addEventListener('mousemove', dragBound);
    this.hammer.on('panmove', dragBound);

  } else {
    translateInitial = {x: this.translateX, y: this.translateY};
    translateBound = this.translate.bind(this);
    _resetBound = _reset.bind(this, translateBound, mouseupBound);
    // this.canvas.addEventListener('mousemove', translateBound);  //TODO change to hammer
  }
  // this.canvas.addEventListener('mouseup', mouseupBound);
  this.hammer.on('panend', mouseupBound);
};

CanvasDemo.prototype.drag = function(shape, event) {
  event = event.srcEvent;
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
  event = event.srcEvent;
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

CanvasDemo.prototype.mouseup = function() {
  _resetBound();
}

function _reset(dragBound, mouseupBound) {
  mousePointInitial = null;
  shapePointInitial = null;
  translateInitial = null;
  // this.canvas.removeEventListener('mousemove', dragBound);
  // this.canvas.removeEventListener('mouseup', mouseupBound);
  this.hammer.off('panmove', dragBound);
  this.hammer.off('panend', mouseupBound);
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
