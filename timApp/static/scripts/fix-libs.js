const replace = require('replace-in-file');

// Fixes some issues with JSPM watcher:
// - watchman is off by default
// - config files are excluded from the set of watched files because otherwise the underlying fs.watch call will also
//   watch node_modules and jspm_packages that have lots of files
// - fixes apparently incorrect value passed as glob
// - uses polling (it is more reliable; the non-poll method sometimes misses changes)
replace.sync({
    files: 'node_modules/jspm/lib/bundle.js',
    from: [
        'files = files.concat(configFiles);',
        'var watchman = true;',
        'glob: watchman && watchFiles'
    ],
    to: [
        'files = files.concat([]);',
        'var watchman = false;',
        'glob: relFiles, poll: true, interval: 500'
    ]
});

// Fixes KaTeX auto-render extension so that it will throw exceptions instead of printing to console.
replace.sync({
    files: 'jspm_packages/npm/katex@0.7.1/dist/contrib/auto-render.min.js',
    from: 'f instanceof katex.ParseError',
    to: 'false'
});

// This was an attempt to make some uib-bootstrap component attributes optional so that they work with
// strictComponentBindingsEnabled, but it wasn't enough.
// replace.sync({
//     files: [
//         'jspm_packages/npm/angular-ui-bootstrap@2.5.0/dist/ui-bootstrap-tpls.js',
//         'jspm_packages/npm/angular-ui-bootstrap@2.5.0/dist/ui-bootstrap.js',
//         'jspm_packages/npm/angular-ui-bootstrap@2.5.0/src/tabs/tabs.js',
//     ],
//     from: [/'@'/g, /'='/g, /'&'/g, /'&select'/g, /'&deselect'/g],
//     to: ["'@?'", "'=?'", "'&?'", "'&?select'", "'&?deselect'"]
// });
