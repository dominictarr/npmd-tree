var pull = require('pull-stream')
var pfs  = require('pull-fs')
var fs   = require('fs')
var path = require('path')

var $ = require('tree-query')

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

//todo: create the same datastructure as resolve.

function tree (dir, cb) {
  if(!cb) cb = dir, dir = null
  dir = dir || process.cwd()

  findPackage(dir, function (err, pkg) {
    pull(
      pull.depthFirst(pkg, function (pkg) {
        return pull(
          pfs.readdir(path.resolve(pkg.path, 'node_modules')),
          pull.filter(),
          pfs.resolve('package.json'),
          pfs.isFile(),
          readJson()          
        )
      }),
      filter(),
      pull.collect(cb)
    )
  })
}

if(!module.parent)
  tree  (function (err, data) {
    console.log(err, data)
  })

