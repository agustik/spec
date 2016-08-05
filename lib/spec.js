'use strict'
var fs = require('fs');

var argv = require('yargs').argv;

var semver = require('semver');

var path = require('path');

var Git = require("nodegit");

var prompt = require('prompt');

var hogan = require('hogan.js');

var specTemplateContent = readFile('./lib/templates/template.spec');

var specTemplate = hogan.compile(specTemplateContent);

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
  var prefix = "";

  if (current.charAt(0) === 'v'){
    prefix = 'v';
  }

    return prefix + semver.inc(current, _Release);
}

function getLatestTag(tags){
  var SortedTags = SortTags(tags);
  return SortedTags.pop();
}
var Directory = process.cwd();

var spec = {
  up : function (){



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
              console.log("New Commit:", commitId.allocfmt());
              return commitId;
            })
            .then(function (oid){
              repo.createTag(oid, next, _GitTagMessage)
                .then(function (res){
                  console.log('Tagged with tag:', next );
                  console.log('git push origin', next );
                });
            })
            .done();
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

  },
  init : function (){


    var pack = readFile(Directory + '/package.json');

    var _package = JSON.parse(pack);

    console.log(_package)


    // Get all files included and dir in Git

    var files = [];

    var folders = [];
    Git.Repository.open(path.resolve(__dirname, "../.git"))
      .then(function(repo) {
        return repo.getMasterCommit();
      })
      .then(function(firstCommitOnMaster) {
          return firstCommitOnMaster.getTree();
      })
      .then(function(tree) {
        // `walk()` returns an event.
        var walker = tree.walk();
        walker.on("entry", function(entry) {
          console.log('ENTRY', entry.path());
        });

        // Don't forget to call `start()`!
        walker.start();
      })
      .done();


    var version = _package.version;
    var license = _package.license;
    var name    = _package.name;

    var description = _package.description;
    var schema = {
      properties: {

        name : {
          default : name
        },
        license : {
          default : license
        },
        version : {
          default : version
        },
        type : {
          default : 'node'
        },
        description : {
          default : description
        },
        buildrequires : {
          default : 'npm git'
        },
        summary : {
          default : 'awesome project'
        },
        requires : {
          default : 'nodejs'
        },
        build : {
          default : 'npm install'
        },
        config : {
          default : true
        }

        //,
        // password: {
        //   hidden: true,
        //   required : true,
        //   conform : function (value){
        //
        //   }
        // }
      }
    };

    prompt.start();

    prompt.get(schema, function (err, result) {


      result.config = (result.config == 'true') || false;

      var specConfigFile = Directory + '/.specfile';

      writeFile(specConfigFile, JSON.stringify(result, null, 2));

      var spec = specTemplate.render(result);

      console.log(spec);

      console.log(result);
      writeFile(result.name + '.spec', spec);

    });
  }
};

module.exports = spec;
