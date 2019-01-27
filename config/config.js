
var CONST ={};
CONST.SESSION_TIMEOUT = 24*60*60*1000;
CONST.CHECK_POOL_TIMEOUT = 5*60*1000;//检查数据库是否正常，间隔大于5分钟，由网页端触发
CONST.LOG_DIR = "/tmp/";

CONST.REMOTE_DB = {
        connectionLimit : 5,
        host : 'daxumi.net',
        port : 6612,
        user : 'lxm',
        password : '',
        database : 'report',
        multipleStatements:true,
        acquireTimeout:30000
};

CONST.LOCAL_DB = {
        connectionLimit : 5,
        host : 'localhost',
        port : 3306,
        user : 'lxm',
        password : '',
        database : 'dxm',
        multipleStatements:true,
        acquireTimeout:30000
};


Object.freeze(CONST);


exports.CONST = CONST;
//exports.mysqljs = mysqljs;

/*
var mysqljs={
    connParam:{
        connectionLimit : 150,
        host : '192.168.124.3',
        port : 3306,
        user : 'lxm',
        password : '',
        database : 'report',
        multipleStatements:true,
        acquireTimeout:30000
    }
};

var localmysqljs={
    connParam:{
        connectionLimit : 150,
        host : 'localhost',
        port : 3306,
        user : 'lxm',
        password : '',
        database : 'report',
        multipleStatements:true,
        acquireTimeout:30000
    }
};
*/
