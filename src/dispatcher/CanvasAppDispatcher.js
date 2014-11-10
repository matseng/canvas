"use strict";

var Dispatcher = require('flux').Dispatcher;
var assign = require('object-assign');

var CanvasDispatcher = assign(new Dispatcher(), {
  //Add custom dispatcher methods here
});

module.exports = CanvasDispatcher;