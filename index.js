#! /usr/bin/env node
var fs   = require('fs')
var path = require('path')
var pull = require('pull-stream')
var pfs  = require('pull-fs')
var paramap = require('pull-paramap')
var clean = require('./clean')
var cont = require('continuable')
var para = require('continuable-para')

function filter () {
  return pull(pull.filter(),
    pull.map(function (pkg) {
      return {
        name   : pkg.name,
        version: pkg.version,
        path   : pkg.path
      }
    })
  )
}

function first (cb) {
  var f
  return pull.drain(
    function (data) { f = data; return false },
    function (err) { cb(err === true ? null : err, f) }
  )
}

var readJson = cont.to(function (file, cb) {
  fs.readFile(file, 'utf8', function (err, data) {
    if(err) return cb(err)
    var json
    try { json = JSON.parse(data) }
    catch (err) { return cb(err) }
    json.path = path.dirname(file)
    cb(null, json)
  })
})

var exists = cont.to(function (file, cb) {
  fs.stat(file, function (err, stat) {
    cb(null, stat)
  })
})


function readPackage (dir, cb) {
  var pkg
  para([
    readJson(path.resolve(dir, 'package.json')),
    exists(path.resolve(dir, 'bindings.gyp'))
  ]) (function (err, data) {
    if(!err) {
      pkg = data[0]
      if(!!data[1])
        pkg.gypfile = true
      pkg.path = dir
    }
    cb(err, pkg)
  })
}

function maybe(test) {
  return function (arg, cb) {
    test(arg, function (err, value) {
      cb(null, value)
    })
  }
}


function findPackage (dir, cb) {
  if(!cb) cb = dir, dir = null
  dir = dir || process.cwd()

  pull(
    pfs.ancestors(dir),
    pfs.resolve('package.json'),
    pfs.isFile(),
    pull.asyncMap(maybe(readJson)),
    pull.filter(),
    first(cb)
  )
}

//retrive the current files, 
function ls (dir, cb) {
  if(!cb) cb = dir, dir = null

  dir = dir || process.cwd()

  pull(
    pfs.ancestors(dir),
    pfs.resolve('node_modules'),
    pfs.star(),
    pull.filter(Boolean),
    paramap(maybe(readPackage)),
    filter(),
    pull.unique('name'),
    pull.reduce(function (obj, val) {
      if(!obj[val.name])
        obj[val.name] = val
      return obj
    }, {}, function (err, obj) {
      cb(err, obj)
    })
  )
}

//creates the same datastructure as resolve,
//selecting all dependencies...

function tree (dir, opts, cb) {
  var i = 0
  findPackage(dir, function (err, pkg) {
    pull(
      pull.depthFirst(pkg, function (pkg) {
        pkg.tree = {}
        return pull(
          pfs.readdir(path.resolve(pkg.path, 'node_modules')),
          paramap(maybe(readPackage)),
          pull.filter(function (_pkg) {
            if(!_pkg) return
            _pkg.parent = pkg
            
            pkg.tree[_pkg.name] = _pkg
            return pkg
          })
        )
      }),
      opts.post ? paramap(function (data, cb) {
        //run a post install-style hook.
        opts.post(data, cb)
      }) : pull.through(),
      pull.drain(null, function (err) {
        cb(err === true ? null : err, clean(pkg))
      })
    )
  })
}

exports.tree = tree
exports.findPackage = findPackage
exports.ls = ls

if(!module.parent) {
  var config = require('npmd-config')
  var exec = require('child_process').exec
  if(config.version) {
    console.log(require('./package').version)
    process.exit(0)
  }

  if(config.ls)
    ls(process.cwd(), function (err, data) {
      if(err) throw err
      console.log(JSON.stringify(data, null, 2))
    })
  else if(config.pkg)
    findPackage(process.cwd(), function (err, data) {
      if(err) throw err
      console.log(JSON.stringify(data, null, 2))
    })
  else {
    config.post =
      function (data, cb) {
        if(!config.c) return cb(null, data)
        var cp =
          exec(config.c, {cwd: data.path}, function (err, stdout) {
            cb(err, data)
          })
        cp.stdout.pipe(process.stdout)
        cp.stderr.pipe(process.stderr)
      }

    var target = config._[0] || config.path

    if(!/^[./]/.test(target))
      target =
        path.join(config.path, 'node_modules', target)

    if(config.verbose)
      console.error('traversing tree starting at:', target)

    tree(target, config, function (err, tree) {
      if(err) throw err
      if(!config.quiet || !config.c)
        console.log(JSON.stringify(tree, null, 2))
    })
  }
}

