(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/Users/mtseng/Vindico/matsengGithub/canvas/src/nav/nav.js":[function(require,module,exports){

module.exports = hw;

function hw() {
  var test = 'hello world watch'
  console.log(test);
  return test;
};



function zoomStart() {};

function zoom() {};

function zoomEnd() {};
},{}],"/Users/mtseng/Vindico/matsengGithub/canvas/src/nav/tests/spec/moduleSpec.js":[function(require,module,exports){
var hw = require('../../nav.js')

describe('ModuleName', function() {
  describe('Method name', function() {
    it('should ', function() {
      hw();
    });
  });
});
},{"../../nav.js":"/Users/mtseng/Vindico/matsengGithub/canvas/src/nav/nav.js"}]},{},["/Users/mtseng/Vindico/matsengGithub/canvas/src/nav/tests/spec/moduleSpec.js"]);
