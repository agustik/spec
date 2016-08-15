#!/usr/bin/env node


var spec = require('./lib/spec.js');

var argv = require('yargs').argv;

var type = argv.t || argv.type || 'node';


switch (argv._[0]) {
  case 'up':
    spec.up();
    break;
  case 'init':
    spec.init(type);
    break;
  default:

}
