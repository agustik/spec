'use strict'
var fs = require('fs');

var argv = require('yargs').argv;

var semver = require('semver');

var path = require('path');

var Git = require("nodegit");


// Set version manually?
var _Version = argv.v || false;

// Version bump?
var _Release = argv.r || 'patch';

// git tag it ?
var _GitTagIt = argv.g || false;

// git tag it ?
var _GitTagMessage = argv.m || "Tagged by specup";


console.log({
  version : _Version,
  bump : _Release,
  git : _GitTagIt
});


function readFile(_path){
  try {
    return fs.readFileSync(_path).toString('utf-8');
  } catch (e) {
    return false;
  }
}
function writeFile(_path, content){
  console.log(_path, 'Write');
  try {
    return fs.writeFileSync(_path, content);
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

function setNpmVersion(npm, version){

  if (typeof npm === 'string'){
    npm = JSON.parse(npm);
  }

  npm.version = version;

  return JSON.stringify(npm, null, 2);
}


function SortTags(tags){
  return tags.sort(function (a, b){
    if(semver.gt(a,b)){
      return 1;
    }

    if(semver.lt(a,b)){
      return -1;
    }

    return 0;
  });
}
function setNextTag(current){


  return semver.inc(current, _Release);

}

function getLatestTag(tags){
  var SortedTags = SortTags(tags);
  return SortedTags.pop();
}

dir('.', function (err, list){
  var specContent, specFileName, packageContent, npmVersion, specVersion;

  list.forEach(function (file){
    var parsed = path.parse(file);

    if (file === 'package.json'){
      packageContent = fs.readFileSync(file).toString('utf8');
    }

    if (parsed.ext === '.spec'){
     specFileName = file;
     specContent = fs.readFileSync(file).toString('utf8');
    }
  });

  if (packageContent){
    npmVersion = JSON.parse(packageContent).version;
  }
  if (specContent){
    specVersion = getSpecVersion(specContent);
  }


  //setSpecVersion(specContent, '0.0.2');

  var repo;

  var tags = Git.Repository.open('.').then(function (repoResult) {
      repo = repoResult;
      return Git.Tag.list(repo);
  });

  tags.then(function (listOfTags){
    var tag = getLatestTag(listOfTags);

    var next = setNextTag(tag);

    if (_Version){
      next = _Version;
    }

    console.log(
      {
        spec : specVersion,
        npm : npmVersion,
        git_current : tag,
        next : next
      }
    );


    if (_GitTagIt){
      repo.createTag(next, next, _GitTagMessage).then(function (res){
        console.log(res);
      })
    }


    if (specContent){
      writeFile(
        specFileName,
        setSpecVersion(specContent, next)
      )
    }
    if (packageContent){
      writeFile(
        'package.json',
        setNpmVersion(packageContent, next)
      )
    }
  });

});
