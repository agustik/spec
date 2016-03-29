'use strict'
var fs = require('fs');

var argv = require('yargs').argv;

var semver = require('semver');

var path = require('path');

var Git = require("nodegit");


function readFile(_path){
  try {
    return fs.readFileSync(_path).toString('utf-8');
  } catch (e) {
    return false;
  }
}

function dir(_path, callback){
  fs.readdir(_path, callback);
}

function getSpecVersion(specfile){
  var lines = specfile.split('\n');

  var reg = new RegExp(/Version:[\s+]/);
  var temp;

  var version = "";

  lines.forEach(function (line){
    if (reg.test(line)){
      temp = line.split(':')[1].replace(/\s+/g, '');

      version = temp;
    }
  });
  return version;
}

function setSpecVersion(specfile, version){
  var lines = specfile.split('\n');

  var reg = new RegExp(/Version:[\s+]/);

  lines = lines.map(function (line){
    if (reg.test(line)){
      return 'Version:\t' + version;
    }
    return line;
  });


  return lines.join('\n')
}




// console.log(process)
//

dir('.', function (err, list){


  var specFile, npmFile, npmVersion, specVersion;

  list.forEach(function (file){
    var parsed = path.parse(file);

    if (file === 'package.json'){
      npmFile = fs.readFileSync(file).toString('utf8');
    }

    if (parsed.ext === '.spec'){
     specFile = fs.readFileSync(file).toString('utf8');
    }
  });

  if (npmFile){
    npmVersion = JSON.parse(npmFile).version;
  }
  if (specFile){
    specVersion = getSpecVersion(specFile);
  }
  setSpecVersion(specFile, '0.0.2');
});



Git.Repository.open('.').then(function (repo){
  console.log(repo);

  Git
    .Tag.list()
    .then(function (tag){
      console.log(tag)
    })

})
