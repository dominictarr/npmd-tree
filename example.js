
var $ = require('tree-query')
var fs = require('fs')
$('**/*.js')
  .paraMap(function (file, cb) {
    fs.readFile(file, 'utf8', function (err, string) {
      var i = 0
      var matches = string.split('\n').map(function (l) {
        if(/maybeSink/.test(l))
          return {line: l, number: i++}
      }).filter(Boolean)
      cb(null, matches.length && {
        file: file,
        matches: matches
                 })
    })
  })
  .filter()
  .log()
