'use strict'
var fs = require('fs');

var argv = require('yargs').argv;

var semver = require('semver');

var path = require('path');

var Git = require("nodegit");

var prompt = require('prompt');

var hogan = require('hogan.js');

var async = require('async');
var Directory = process.cwd();


var specTemplateContent = readFile(__dirname + '/templates/template.hjs');

var specTemplate = hogan.compile(specTemplateContent);

function readFile(_path){
  try {
    return fs.readFileSync(_path).toString('utf-8');
  } catch (e) {
    console.log(e);
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

function bool(bool){
  if (bool === 'true') return true;
  return false;
}

function stat(_path, callback){


  fs.stat(_path, callback)
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
  init : function (type){


    var pack = readFile(Directory + '/package.json');

    var _package = JSON.parse(pack);

    type = type || 'node';

    var files = [];

    var folders = [];

    var exclude = ['node_modules', '.git', 'config.js'];

    var docs = [];

    var systemd = false;

    var includes = {
      node : ['.json', '.js', '.hjs'],
      bash : [''],
      python : ['.py']
    }

    var includeExt = includes[type];

    dir('.', function (err, res){

      if (err) return console.log('Error reading dir');


      async.eachSeries(res, function (item, _next){
        if (exclude.indexOf(item) > -1 ) return _next();

        if (item.charAt(0) === '.') return _next();

        if (/.service/.test(item)) {
          systemd = item;
          return _next();
        }

        if (/LICENSE/.test(item) || /README/.test(item)){
          docs.push(item);
          return _next();
        }

        stat(item, function (err, stat){
          if (stat.isDirectory()){
            folders.push(item);
          }else{
            var parsed = path.parse(item);
            if (includeExt.indexOf(parsed.ext) > -1){
              files.push(item);
            }

          }
          _next();
        })
      }, rest);


    });




    var version = _package.version;
    var license = _package.license;
    var name    = _package.name;

    var description = _package.description;

    var requirementsDefaults = {
     node : 'nodejs'
    };
    var buildRequirementsDefaults = {
     node : 'npm git'
    };

    var buildDefaults = {
      node : 'npm install'
    };

    var requirements = requirementsDefaults[type] || '';

    var buildRequirements = buildRequirementsDefaults[type] || '';

    var build = buildDefaults[type] || '';

    function rest(){
      prompt.start();

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
          description : {
            default : description
          },
          buildrequires : {
            default : buildRequirements
          },
          summary : {
            default : 'awesome project'
          },
          requires : {
            default : requirements
          },
          build : {
            default : build
          },
          config : {
            default : true
          },
          folders : {
            default : folders
          },
          files : {
            default : files
          },
          repo : {
            default : 'http://awesomeprotject.io'
          },
          systemd : {
            default : systemd
          }
        }
      };

      prompt.get(schema, function (err, result) {

        result.folders = result.folders.split(',');
        result.files = result.files.split(',');
        result.is_systemd = false;


        result.systemd = bool(result.systemd);

        result.docs = docs.join(' ');

        result.config = bool((result.config == 'true') || false);

        var specConfigFile = Directory + '/.specfile';

        writeFile(specConfigFile, JSON.stringify(result, null, 2));

        var spec = specTemplate.render(result);
        var specFileName = result.name + '.spec';
        writeFile(specFileName, spec);
        console.log('Wrote', specFileName);
      });
    }

  }
};

module.exports = spec;
