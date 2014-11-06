window.onload = run;

function run() {
 var cd = new CanvasDemo();
};

var Rect = function(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.getDimensions = function() {
  return [this.x, this.y, this.width, this.height];
};

var CanvasDemo = function() {
  this.canvas = document.getElementById('canvas');
  this.shapes = [];
  this.translateX = 0;
  this.translateY = 0;

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
  // point.x = point.x + this.translateX;
  // point.y = point.y + this.translateY;
  var shape = this.rect;
  for(var i = 0; i < this.shapes.length; i++) {
    shape = this.shapes[i];
    if ( (shape.x <= point.x) && (point.x <= shape.x + shape.width) && (shape.y <= point.y) && (point.y <= shape.y + shape.height) ){
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
