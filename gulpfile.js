var gulp = require('gulp'),
    fs = require('fs'),
    livereload = require('gulp-livereload'),
    embedlr = require('gulp-embedlr'),
    express = require('express'),
    bodyParser = require('body-parser'),
    os = require('os'),
    uglify = require('gulp-uglify'),
    htmlreplace = require('gulp-html-replace'),
    streamify = require('gulp-streamify'),
    browserify = require('browserify'),
    watchify = require('watchify'),
    reactify = require('reactify'),
    lessify = require('node-lessify'),
    source = require('vinyl-source-stream');


var get_ip = function (internal) {
    hosts = [];
    iface = os.networkInterfaces();
    for (var key in iface) {
        if (internal || iface[key][0].address.substring(0,3) !== '127') {
            hosts.push(iface[key][0].address);
        }
    }
    return hosts[0];
};

var local = false,
    config = {
        HOST: get_ip(local),
        PORT: 8000,
        LRPORT: 35728,
        ENTRY_POINT: 'src/app.js',
        OUT: 'build.js',
        MINIFIED_OUT: 'build.min.js',
        DEST: 'dist',
        HTML: 'src/index.html',
    };


gulp.task('copy', function(){
    gulp.src(config.HTML)
        .pipe(gulp.dest(config.DEST));
});

gulp.task('lrcopy', function(){
    gulp.src(config.HTML)
        .pipe(htmlreplace({
            'js': config.OUT
        }))
        .pipe(embedlr({host: config.HOST, port: config.LRPORT}))
        .pipe(gulp.dest(config.DEST))
        .pipe(livereload(config.LRPORT));
});

gulp.task('watch', function(){
    gulp.watch(config.HTML, ['lrcopy']);

    var watcher = watchify(browserify({
        entries: [config.ENTRY_POINT],
        transform: [reactify, lessify],
        debug: true,
        cache: {}, packageCache: {}, fullPaths: true
    }));
    return watcher.on('update', function() {
        watcher.bundle()
               .pipe(source(config.OUT))
               .pipe(gulp.dest(config.DEST))
               .pipe(livereload(config.LRPORT))
               console.log('Updated');
    })
    .bundle()
    .pipe(source(config.OUT))
    .pipe(gulp.dest(config.DEST))
    .pipe(livereload(config.LRPORT));
});

gulp.task('build', function(){
    browserify({
        entries: [config.ENTRY_POINT],
        transform: [reactify, lessify]
    })
    .bundle()
    .pipe(source(config.MINIFIED_OUT))
    .pipe(streamify(uglify({file: config.MINIFIED_OUT})))
    .pipe(gulp.dest(config.DEST));
});

gulp.task('serve', function() {
    var app = express();
    app.use(express.static('data'));
    app.use(express.static(config.DEST));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));

    app.get(/^\/(.*\.json)/, function(req, res) {
        console.log(req.params['0']);

        fs.readFile(req.params['0'], function(err, data) {
            res.setHeader('Cache-Control', 'no-cache');
            res.json(JSON.parse(data));
        });
    });  
    app.post(/^\/(.*\.json)/, function(req, res) {
        fs.readFile(req.params['0'], function(err, data) {
            var json = JSON.parse(data);
            json.push(req.body);

            fs.writeFile(req.params['0'], JSON.stringify(json, null, 4), function(err) {
                res.setHeader('Cache-Control', 'no-cache');
                res.send(json);
            });
        });
    });  

    app.listen(config.PORT);
    console.log('Serving site on http://' + config.HOST + ':' + config.PORT);
});

gulp.task('lrserve', function(){
    livereload.listen({host: config.HOST, port: config.LRPORT});
    console.log('Reload server started on http://' + config.HOST + ':' + config.LRPORT);
});

gulp.task('default', ['serve', 'lrserve', 'lrcopy', 'watch']);
gulp.task('production', ['serve', 'copy', 'build']);
