#!/usr/bin/env node

'use strict'
var fs = require('fs');

var argv = require('yargs').argv;

var semver = require('semver');

var path = require('path');

var Git = require("nodegit");

var Directory = process.cwd();


// Set version manually?
var _Version = argv.v || false;

// Version bump?
var _Release = argv.r || 'patch';

// git tag it ?
var _GitTagIt = argv.g || false;

var _Dry = argv.d || false;
// git tag it ?
var _GitTagMessage = argv.m || "Tagged by specup";

if (argv.h || argv.help){
  return console.log(
    [
    'specup is for maintain nodejs modules and spec file in one command',
    '-r [release] || default to "patch"',
    '-g || tag it with git?, default is false',
    '-m [message] || tag message, default to "Tagged by specup"',
    '-v [version] || set your own version',
    '-d || dry run'
    ].join('\n')
  )
}

// console.log({
//   version : _Version,
//   bump : _Release,
//   git : _GitTagIt
// });


function readFile(_path){
  try {
    return fs.readFileSync(_path).toString('utf-8');
  } catch (e) {
    return false;
  }
}
function writeFile(_path, content){
  try {
    return fs.writeFileSync(_path, content);
  } catch (e) {
    return false;
  }
}

function dir(_path, callback){
  fs.readdir(_path, callback);
}

function getLastCommit(repo, callback){

  Git.Revparse.single(repo, 'HEAD').then(function(object) {


    var oid = object.id();

    callback(null, oid);
  }, callback);
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
function getNextTag(current){
  return semver.inc(current, _Release);
}

function getLatestTag(tags){
  var SortedTags = SortTags(tags);
  return SortedTags.pop();
}

dir(Directory, function (err, list){
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

  if (!packageContent && !specContent){
    return console.log([
      'No specfile and no package.json found :/',
      'Are you in the right place?',
      '',
      'Current dir: '+Directory
    ].join('\n'));
  }

  var repo;

  var tags = Git.Repository.open(Directory).then(function (repoResult) {
      repo = repoResult;
      return Git.Tag.list(repo);
  });

  tags.then(function (listOfTags){
    var tag = getLatestTag(listOfTags);

    var next = getNextTag(tag);

    next = next || npmVersion;

    if (_Version){
      next = _Version;
    }

    console.log(JSON.stringify({
        current_spec_version : specVersion,
        current_npm_version : npmVersion,
        git_current_version : tag,
        next : next
      }, null, 2 ));


    if (_Dry){
      return;
    }

    if (_GitTagIt){
      var signature = repo.defaultSignature();
      repo.createCommitOnHead(['package.json', specFileName], signature, signature,  _GitTagMessage)
        .then(function(commitId) {
          // the file is removed from the git repo, use fs.unlink now to remove it
          // from the filesystem.
          console.log("New Commit:", commitId.allocfmt(), commitId);

          return commitId;
        })
        .then(function (oid){
          repo.createTag(oid, next, _GitTagMessage)
            .then(function (res){
              console.log('Tagged with tag:', next );
            });
        })
        .done();

      // getLastCommit(repo, function (err, oid){
      //   if (!err){
      //     repo.createTag(oid, next, _GitTagMessage).then(function (res){
      //     }, function (e){console.log('error?', e)})
      //   }
      // });
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
