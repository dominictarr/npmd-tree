# npmd-tree

query/traverse the `node_modules` tree

[![travis](https://travis-ci.org/dominictarr/npmd-tree.png?branch=master)
](https://travis-ci.org/dominictarr/npmd-tree)

## example

``` js
#show the tree, as json.

npmd-tree

# compile binary deps.

npmd-tree -c 'if ( test -e binding.gyp) then node-gyp rebuild; fi' --quiet
```

or from javascript

``` js
var tree = require('npmd-tree').tree
var spawn = require('child_process)'.spawn
tree(process.cwd(), {post: function (pkg, cb) {
  //optionally, perform an async step, such as build the repo.
  if(!pkg.gypfile) return cb(null, pkg)

  var cp = spawn('node-gyp', ['rebuild'], {cwd: pkg.path})
  cp.stdout.pipe(process.stdout)
  cp.stderr.pipe(process.stderr)
  cp.on('exit', next)
  cp.on('error', next)
  var ended = false
  function next (err) {
    if(ended) return
    ended = true
    cb(err)
  }
}, function (err, tree) {
  if(err) throw err
  console.log(tree)
})

```

## License

MIT
