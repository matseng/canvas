// FocusView.js
"use strict";

var FocusStore = require('../stores/FocusStore');
var TransformStore = require('../stores/TransformStore');

var _transform;
var _textareaElement;

function _updateStateFromStores() {
  _transform = TransformStore.get();
};

function _globalToWindowTransform(globalObj) {
  var windowObj = {};
  windowObj.x = (globalObj.x + _transform.translateX) * _transform.scale;
  windowObj.y = (globalObj.y + _transform.translateY) * _transform.scale;
  if ( globalObj.width && globalObj.height) {
    windowObj.width = globalObj.width * _transform.scale;
    windowObj.height = globalObj.height * _transform.scale;
    return windowObj;
  }
  return windowObj;
};

var FocusView = {

  init: function() {
    _textareaElement = document.getElementById('textarea');
    FocusStore.addChangeListener('changed', function() {
      _updateStateFromStores();
      FocusView.render();
    });
  },

  render: function() {
    console.log('switch to textarea');
    var note = FocusStore.getFocusDoubleTap();
    if (note) {
      var textareaRectGlobal = {
        x: note.data.x,
        y: note.data.y,
        width: note.style.width,
        height: note.style.height
      };
      var textareaRectWindow = _globalToWindowTransform(textareaRectGlobal);
      var deltaToOriginX = - note.style.width * (1 - _transform.scale) / 2;
      var deltaToOriginY = - note.style.height * (1 - _transform.scale) / 2;
      var translateX = deltaToOriginX + textareaRectWindow.x;
      var translateY = deltaToOriginY + textareaRectWindow.y;

      _textareaElement.value = note.data.text;
      _textareaElement.style.width = note.style.width + "px";
      _textareaElement.style.height = note.style.height + "px";
      _textareaElement.style.transform = "matrix(" + _transform.scale + ", 0, 0, " + _transform.scale + ", " + translateX + ',' + translateY +')';
      _textareaElement.style.webkitTransform = "matrix(" + _transform.scale + ", 0, 0, " + _transform.scale + ", " + translateX + ',' + translateY +')';
      _textareaElement.style.display = 'block';
      _textareaElement.focus();
    }
  }  
}

module.exports = FocusView;


