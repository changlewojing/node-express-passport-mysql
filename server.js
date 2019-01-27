// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var session  = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app      = express();
var port     = process.env.PORT || 8080;

var passport = require('passport');
var flash    = require('connect-flash');

// configuration ===============================================================
// connect to our database

require('./config/passport')(passport); // pass passport for configuration



// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.set('view engine', 'ejs'); // set up ejs for templating
/**********************************
  * session store
  */
/***********mysqlstore初始化
var MySQLStore = require('express-mysql-session')(session);
var options = {
  host: 'localhost',
  port: 3306,
  user: 'lxm',
  password: '',
  database: 'dxm'
};
var sessionStore = new MySQLStore(options);


// required for passport
app.use(session({
	secret: 'vidyapathaisalwaysrunning',
        store: sessionStore,
	resave: true,
	saveUninitialized: true
 } )); // session secret
*/

options = {};
var RedisStore = require('connect-redis')(session);
app.use(session({
  store: new RedisStore(options),
  secret: 'secret123456',
  resave: false,
  //cookie:{expires:new Date(),maxAge:1000*60*60}//1分钟
  cookie:{maxAge:1000*60*24*60}//1天24小时
}));

/*********sessionstore初始化结束************************************/



app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session


// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);
