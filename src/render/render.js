module.exports = (function() {
  
  var Render = function() {
    this.canvas;
    this.ctx;
    this.shapes;
    this.transform;
    this.notes;
  };

  Render.prototype.init = function(canvas, notes, transform) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.notes = notes;
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

  Render.prototype.drawNotes = function() {
    this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
    this.ctx.translate(this.transform.translateX * this.transform.scale, this.transform.translateY * this.transform.scale);
    for(var i = 0; i < this.notes.length; i++) {
      var note = this.notes[i];
      this.ctx.fillStyle = 'rgba(200,0,0,0.5)';
      this.ctx.fillRect.apply(this.ctx, [note.data.x * this.transform.scale, note.data.y * this.transform.scale, note.style.width * this.transform.scale, note.style.height * this.transform.scale]);
    }
    this.ctx.translate(-this.transform.translateX * this.transform.scale, -this.transform.translateY * this.transform.scale);
  };

  return new Render();

})();
