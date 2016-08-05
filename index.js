#!/usr/bin/env node


var spec = require('./lib/spec.js');

var argv = require('yargs').argv;


switch (argv._[0]) {
  case 'up':
    spec.up();
    break;
  case 'init':
    spec.init();
    break;
  default:

}
