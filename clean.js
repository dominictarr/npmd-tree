var fields = ['name', 'version', 'from', 'gypfile', 'shasum']

function isEmpty (obj) {
  for(var k in obj)
    return false
  return true
}

module.exports = function clean (pkg) {
  var deps = pkg.dependencies || {}
  var _deps = pkg.tree || {}

//  var shasum = pkg.shasum
  for(var k in pkg)
    if(!~fields.indexOf(k))
      delete pkg[k]

//  pkg.shasum = shasum

  for(var k in _deps) {
    _deps[k].from = deps[k]
    clean(_deps[k])
  }

  pkg.dependencies = _deps
  if(isEmpty(_deps))
    delete pkg.dependencies
  return pkg
}

