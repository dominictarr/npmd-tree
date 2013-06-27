var fs   = require('fs')
var path = require('path')
var pull = require('pull-stream')
var pfs  = require('pull-fs')

function readJson () {
  return pull.asyncMap(function (file, cb) {
    fs.readFile(file, 'utf8', function (err, data) {
      if(err) return cb()
      var json
      try { json = JSON.parse(data) }
      catch (err) { return cb() }
      json.path = path.dirname(file)
      cb(null, json)
    })
  })
}

function filter () {
  return pull.map(function (pkg) {
    return {
      name   : pkg.name,
      version: pkg.version,
      path   : pkg.path
    }
  })
}

function first (cb) {
  var f
  return pull.drain(
    function (data) { f = data; return false },
    function (err) { cb(err === true ? null : err, f) }
  )
}

function findPackage (dir, cb) {
  if(!cb) cb = dir, dir = null
  dir = dir || process.cwd()

  pull(
    pfs.ancestors(dir),
    pfs.resolve('package.json'),
    pfs.isFile(),
    readJson(),
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
    pfs.resolve('package.json'),
    pull.filter(Boolean),
    readJson(),
    filter(),
    pull.reduce(function (obj, val) {
      if(!obj[val.name])
        obj[val.name] = val
      return obj
    }, {}, function (err, obj) {
      cb(err, obj)
    })
  )
}

function clean (t) {
  var deps = t.dependencies
  var _deps = t.tree || {}

  delete t.tree
  delete t._parent
  delete t.description
  delete t.devDependencies
  delete t.tree
  delete t.scripts
  delete t.parent
  delete t.time
  delete t.size
  delete t.readme
  delete t.author
  delete t.homepage
  delete t._from
  delete t._resolved
  delete t.license
  delete t.bugs
  delete t.repository
  delete t.readmeFilename
  delete t._id
  if(t.dist)
    t.shasum = t.dist.shasum
  delete t.dist
  delete t.path
  delete t.dependencies

  for(var k in _deps) {
    _deps[k].from = deps[k]
    clean(_deps[k])
  }

  t.dependencies = _deps

  return t
}


//todo: create the same datastructure as resolve.

function tree (dir, cb) {
  if(!cb) cb = dir, dir = null
  dir = dir || process.cwd()

  findPackage(dir, function (err, pkg) {
    pull(
      pull.depthFirst(pkg, function (pkg) {
        pkg.tree = {}
        return pull(
          pfs.readdir(path.resolve(pkg.path, 'node_modules')),
          pull.filter(),
          pfs.resolve('package.json'),
          pfs.isFile(),
          readJson(),
          pull.filter(function (_pkg) {
            if(!_pkg) return
            _pkg.parent = pkg
            
            pkg.tree[_pkg.name] = _pkg
            return pkg
          })
        )
      }),
      pull.drain(null, function (err) {
        cb(err === true ? null : err, clean(pkg))
      })
    )
  })
}

exports.tree = tree
exports.findPackage = findPackage
exports.ls = ls

exports.db = function noop () {}
exports.commands = function (db) {
  db.commands.tree = function (config, cb) {
    tree(config.installPath, function (err, tree) {
      if(err) throw err
      console.log(JSON.string)
      cb()
    })
  }
  db.commands.ls = function (config, cb) {
    ls(config.installPath, function (err, tree) {
      if(err) throw err
      console.log(JSON.string)
      cb()
    })
  }
}

if(!module.parent)
  tree(function (err, data) {
    console.log(JSON.stringify(data, null, 2))
  })

