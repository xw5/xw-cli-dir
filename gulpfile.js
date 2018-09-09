var gulp = require("gulp");
var gp = require("gulp-load-plugins")();
var named = require('vinyl-named');
var webpack = require('webpack-stream');
var webpackConfig = require('./webpack.config');
var runSequence = require("run-sequence");
var browserSync = require('browser-sync').create();
var serverProxy = require('./config/server');
var config = require('./config/config');

console.log(config);
//编译的路径定义
var devUrl = './dist/';
var publishUrl = './publish/';
var revUrl = './temp/rev/';
var cdnUrl = 'http://www.test.com/';
var changeUrl = {
  '\\./assets/': cdnUrl+'assets/',
  '\\./css/': cdnUrl+'css/',
  '\\./js/': cdnUrl+'js/'
};
//环境就是获取
var isDev = process.env.NODE_ENV === 'development';
if(!isDev){
	devUrl = publishUrl;
}
//清除js、css、html、assets、dist、publish
gulp.task("clean:js",function(){
  return gulp.src([devUrl+"js/*.js",devUrl+"js/*.js.map"])
    .pipe(gp.clean())
});
gulp.task("clean:css",function(){
  return gulp.src([devUrl+"css/*.css",devUrl+"css/*.css.map"])
    .pipe(gp.clean())
});
gulp.task("clean:html",function(){
  return gulp.src(devUrl+"*.html")
    .pipe(gp.clean())
});
gulp.task("clean:assets",function(){
  return gulp.src(devUrl+'assets')
    .pipe(gp.clean())
});
gulp.task("clean:dist",function(){
  return gulp.src(devUrl)
    .pipe(gp.clean())
});
gulp.task("clean:publish",function(){
  return gulp.src(publishUrl)
    .pipe(gp.clean())
});

//错误处理
function showErr(error){
  console.error(error.toString());
  this.emit('end')
}

//开发环境编译less任务,同时做兼容处理
gulp.task('cssresolve',function(){
	return gulp.src(config.css === 'less' ? './src/less/*.less' :'./src/sass/*.scss')
	.pipe(gp.debug({title:config.css === 'less' ? 'less解析:' : 'scss解析:'}))
	.pipe(gp.sourcemaps.init())
	//less解析
	.pipe(gp.if(config.css === 'less',gp.less()))
	.pipe(gp.if(config.css === 'scss',gp.sass()))
	//浏览器兼容前缀添加
	.pipe(gp.autoprefixer({
		browsers:["last 1000 versions"]
	}))
	.on('error',showErr)
	.pipe(gp.if(!isDev, gp.cleanCss({compatibility: 'ie8'})))
	.pipe(gp.rev())
	.pipe(gp.sourcemaps.write('.'))
	.pipe(gulp.dest(devUrl+"css/"))
	.pipe(gp.rev.manifest())
	.pipe(gulp.dest(revUrl+'css/'))
});

//静态等资源移动任务:图片、视频、字体等
gulp.task("assetsMove",function(){
	return gulp.src("./src/assets/**")
	.pipe(gp.changed(devUrl+"assets"))
	.pipe(gp.debug({title:'静态资源移动:'}))
	.on('error',showErr)
	.pipe(gp.rev())
	.pipe(gulp.dest(devUrl+"assets/"))
	.pipe(gp.rev.manifest())
	.pipe(gulp.dest(revUrl+'assets/'))
});

//通用js库插件移动
gulp.task("libMove",function(){
	return gulp.src(["src/js/lib/**"])
    .pipe(gp.changed(devUrl+"js/lib/"))
	.on('error',showErr)
	.pipe(gulp.dest(devUrl+"js/lib/"))
});

//html模板功能实现
gulp.task('include',function(){
	return gulp.src('src/*.html')
    .pipe(gp.debug({title:'html模板解析:'}))
	.pipe(gp.fileInclude({
      prefix: '@@',
      basepath: '@file'
    }))
	.on('error',showErr)
	.pipe(gp.if(!isDev, gp.urlReplace(changeUrl)))
	.pipe(gulp.dest(devUrl))
});

//js模块化开发如果是根据条件走require,webpack,ES6
gulp.task("jspack",function(){
	return gulp.src("./src/js/*.js")
    .pipe(gp.debug({title:config.js ==='webpack'?'js打包webpack:':'js打包require:'}))
	.pipe(gp.sourcemaps.init())
	.pipe(gp.if(config.js === 'webpack' || config.js === 'es6',named()))
	.pipe(gp.if(config.js === 'webpack' || config.js === 'es6',webpack(webpackConfig)))
	.pipe(gp.if(config.js === 'requirejs',
		gp.requirejsOptimize({
			optimize: 'none',
			mainConfigFile: './config/requirejsconfig.js'
	})))
	.pipe(gp.if(!isDev, gp.uglify({
		ie8:true
	})))
	.on('error',showErr)
	.pipe(gp.rev())
	.pipe(gp.sourcemaps.write('.'))
	.pipe(gulp.dest(devUrl+"js"))
	.pipe(gp.rev.manifest())
	.pipe(gulp.dest(revUrl+'js/'))
});

//替换css、js、图片等静态文件版本管理
gulp.task('revHtmlCss', function () {
	return gulp.src([revUrl+'css/*.json', devUrl+'*.html'])
		.pipe(gp.debug({title:'html中的css版本管理:'}))
		.pipe(gp.revCollector())
		.pipe(gulp.dest(devUrl));
});
gulp.task('revHtmlJs', function () {
	return gulp.src([revUrl+'js/*.json', devUrl+'*.html'])
		.pipe(gp.debug({title:'html中的js版本管理:'}))
		.pipe(gp.revCollector())
		.pipe(gulp.dest(devUrl));
});
gulp.task('revHtmlAssets', function () {
	return gulp.src([revUrl+'assets/*.json', devUrl+'*.html'])
		.pipe(gp.debug({title:'html中assets资源版本管理:'}))
		.pipe(gp.revCollector())
		.pipe(gulp.dest(devUrl));
});
gulp.task('revCss', function () {
	return gulp.src([revUrl+'assets/*.json', devUrl+'css/*.css'])
		.pipe(gp.debug({title:'css中assets资源版本管理:'}))
		.pipe(gp.revCollector())
		.pipe(gulp.dest(devUrl+'css'));
});
gulp.task('revJs', function () {
	return gulp.src([revUrl+'assets/*.json', devUrl+'js/*.js'])
		.pipe(gp.debug({title:'js中assets资源版本管理:'}))
		.pipe(gp.revCollector())
		.pipe(gulp.dest(devUrl+'js'));
});

//开启一个自动刷新的服务器,并对css,js,html等资源改变时做自动刷新,同时实现反向代理解决跨域请求的问题
// var server = {
//   baseDir:devUrl,
//   middleware :[
//   	proxyMiddleware(['/docer_exchange'], {target: 'http://zt.wps.cn/partner', changeOrigin: true})
//   ]
// };
gulp.task("server",function(){
	console.log('===================同步服务器开启===================');
	browserSync.init({
		files:[
			devUrl+"css/*.css",
			devUrl+"js/*.js",
			devUrl+"assets/**/*.*",
			devUrl+"*.html"
		],
		server:{
			baseDir:'./dist/',
			middleware :serverProxy.middleware
		}
	})
});

//文件变化监听
gulp.task("watch",function(){
	gulp.watch("src/js/**/*.js",function(){
		console.log('===================js监听到修改===================');
		runSequence("clean:js","jspack","include","revHtmlCss","revHtmlJs","revHtmlAssets","revJs");
	});
	gulp.watch("src/assets/**/*.*",function(){
		console.log('===================assets监听到修改===================');
		runSequence("clean:assets","assetsMove","include","revHtmlCss","revHtmlJs","revHtmlAssets","revCss","revJs");
	});
	gulp.watch(config.css === 'less' ? "src/less/**/*.*" : "src/sass/**/*.*",function(){
		console.log('===================less监听到修改===================');
    	runSequence("clean:css","cssresolve","include","revHtmlCss","revHtmlJs","revHtmlAssets","revCss");
	});
	gulp.watch(["src/*.html","src/template/*.*"],function(){
		console.log('===================html监听到修改===================');
    	runSequence("clean:html","include","revHtmlCss","revHtmlJs","revHtmlAssets");
	});
});

//开发&&构建
gulp.task('dev',function(){
	console.log(isDev?'===================启动开发流程===================':'===================启动构建流程===================')
  runSequence("clean:dist",["cssresolve","libMove","jspack","assetsMove","include"],'revHtmlCss','revHtmlJs','revCss','revJs','revHtmlAssets',"server","watch");
});