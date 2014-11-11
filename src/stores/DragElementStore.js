"use strict";

var assign = require('object-assign');

module.exports = (function() {
  var DragElement = function() {
    this.touchStartWindow = {x: null, y: null};
    this.elementStartGlobal = {
      x: null,
      y: null
    }
  }

  return DragElement;
})();