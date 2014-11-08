module.exports = (function() {
  
  var Render = function() {
    this.canvas;
    this.ctx;
    this.shapes;
    this.transform;
  };

  Render.prototype.init = function(canvas, shapes, transform) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.shapes = shapes;
    this.transform = transform;
  };

  Render.prototype.draw = function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    this.ctx.translate(this.transform.translateX * this.transform.scale, this.transform.translateY * this.transform.scale);
    for(var i = 0; i < this.shapes.length; i++) {
      var shape = this.shapes[i];
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, shape.getDimensions(this.transform.scale));
      // this.ctx.strokeRect(45,45,60,60);
    }
    this.ctx.translate(-this.transform.translateX * this.transform.scale, -this.transform.translateY * this.transform.scale);
  };

  return new Render();

})();
