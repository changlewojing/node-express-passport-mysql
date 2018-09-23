var mysql = require("mysql");
var dns = require("dns");
var config = require("./config.js");


//2017年 09月 08日 星期五 11:20:24 CST
//这种也应该改为单例类
//因为checkIp看起来像是一个方法名字
//但这个实际上已经是单例类了。
//不对，这个是闭包，还不是单例类
//就是var命名的，居然是一个方法，感觉不太对头。
var checkIp = (function(){
    var serverName = "daxumi.net"
    var serverIp = null;
    dns.lookup(serverName, function(err, address, family){
        console.log("初始化地址为："+address);
        serverIp = address;
    });
    return function(cb){
        dns.lookup(serverName, function(err, address, family){
            if(err) cb(err);
            console.log("checkIp...");
            if (serverIp == address){
                console.log('地址不变：' + address);
            }else{
                serverIp = address;
                var err = new Error("数据库地址有变请稍后再试试，半分钟");
                err.name="db002";
                cb(err);
            }
        });
    }
})();

/**
 * 问题：
 * 1.域名没变，但是域名ip变了，这时候
 * 2.nodes在域名变化之前就启动了，这时，pool中还是老地址
 * 解决：
 * 1.如果查询失败，重新创建pool
 * 2.再次检查，如果还是失败，返回错误
 *
 */

exports.checkPool = function(cb){
    //var pool = poolManager.getPool();
    pool.query('SELECT 1 + 1 AS solution', function (err, results, fields) {
        if (err){
            err.message = "db.数据库连接异常！<br>正在尝试重新链接。。。<br>"+err.message;
            err.name="db001";
            cb(err);
            //pool = poolManager.reinitPool();
            pool.query('SELECT 1 + 1 AS solution', function (err, results, fields) {
                if (err){
                    err.message = "db.数据库连接失败！<br>重新创建pool失败！<br>请检查网络或数据库是否正常。。。<br>"+err.message;
                    err.name="db001";
                    return cb(err);//说明重新创建pool也失败了，
                }
                console.log('The solution is: ', results[0].solution);
                cb(null);
            });
        }else cb(null);
    });

    checkIp(function(err){
        if (err){
//https://github.com/mysqljs/mysql/issues/1803
            //pool.end();
            //pool = createPool();
        }
    });
}

var connParam = config.CONST.LOCAL_DB;
var createPool = function(){
  var pool;
  return function(){
    return pool || (pool = mysql.createPool(connParam))
  }
}();
var pool = createPool();

/*
var poolManager = {
  create : function(){
    pool = mysql.createPool(config.CONST.REMOTE_DB);
    pool.on('connection', function (connection) {
         console.log("new connection %d",connection.threadId);
    });
    pool.on('release', function (connection) {
         console.log('Connection %d released', connection.threadId);
    });
    pool.on('enqueue', function () {
         console.log('Waiting for available connection slot');
    });
  },
  cnt : 0
};
*/

           /* 
            for (let i=0;i<10;i++){
              pool.g1etConnection(function(err,conn){
                if (err){
                  console.log("初始化失败:"+i);
                  if (conn){
                    console.log("摧毁conn");
                    conn.destroy();
                  }
                }
                else{
                  console.log(conn.threadId);
                  conn.release();
                }
              });

              //pool.query('SELECT 1 + 1 AS solution', function (err, results, fields) {
              //})
            }
          */
exports.pool = pool;//poolManager.getPool();//pool;



//exports.switchDB = function(){poolManager.switchDB()};





/**
 * 基本场景:
    //userpool[userid]=connection;
    //small用来处理很多小查询，如果每个都去pool取，太浪费了。上千个文件很容易pool就满了，影响其他任务
    //都用一个conn，在这个场景下，没有浪费时间，因为文件一个一个上传，之间空闲时间很大，执行按主键返回一条记录的是毫秒级的吧。
    //------------
    //big用来处理大文件插入，假如每个都去pool取，node就崩溃了，所以是为了节约内存
    //都用一个conn，应该也不浪费时间，大文件一起上传，也受带宽限制，所以一个一个可行。
    //if (typeof(userpool[userid])=="undefined") userpool[userid]=null;

 *  继续，2018年 02月 08日 星期四 11:08:59 CST
    场景:很多小文件时，小文件蜂拥到达web层，问题不在查询，应该在插入。上千个小文件插入时，会把所有数据库连接给占满了，然后或许不稳定。
         大文件，因为要把文件读到内存，再存数据库，所以如果大文件多了，应该一个一个插入比较好。
         假设:如果有多个用户同时上传文件，多个用户同时上传上千个文件，系统资源就不够了
         所以:应该每个用户，在上传一次文件时，专门有一个数据库连接来处理这次任务？
         或者:每个用户，按用户名分配一个数据库连接，但是什么时候收回是个问题。
    问题:1.现在的实现，文件检查都用一个连接了，插入小文件是用pool，大文件依次插入
         2.数据库连接是自己创建的，不是从pool取的，不知利弊如何。
         3.利用了mysqljs的connection的队列功能，交给connection执行的任务是放在队列中的。
    解决:1.如果小文件也和大文件一样，用个"队列"，这样，用不着利用connection队列功能，而且直接用数据库pool就可以了
    问题:1.在保存时，本来不是号称和web层无关吗？
         2.其实有关系了，因为努力优化，就是希望前台用户保存时的感觉好一点
         3.具体表现就是，userid不仅仅是个业务字段，还需要为其分配特定资源，以便可靠执行。
         4.如果用event事件触发方式，当两个用户到达时，用了同一个事件，这样就不是每个用户一个队列了。
    解决:1.可能现在的就是比较合理的:
         2.但是查询就不需要small了吧，查询用pool，因为并发大。或者专门创建一个pool，用来做保存文件时的查询?
         3.小文件插入，每个用户一个connection吧。大小文件分开，比较合理。
         3.1 用户级connection，如果没有，就创建一个/从pool取一个，如果small队列空了，就释放。
         4.大文件插入，就用"队列"，这个队列似乎应该是系统级的,就是那个event。多个用户过来存文件，都要一起排队，这样对系统没有威胁
         4.1 虽然多个用户共享，但是要区别，这是哪个用户的，这个有可能和web层任务有关系。
         4.2 web层，文件上传应该有个任务概念，这个事情有没有完，最好有这个，这个是交互相关的。
*/

//2017.4.26，过一个晚上，连接失效，所以设置超时10分钟就重新取数据库连接。
//2017.4.26，已经在数据库端，设置超时时间为30分钟
//这样如果超过30分钟，就会自动断开，防止数据库资源占用
//node这边，就靠数据库连接池了，如果自己这个地方，一律超时10分钟重连，应该可行吧。
//以后有精力，可以跟踪这个重连，也许会有更合适的数字。
//重新连接，一般也不慢吧。因为这个地方只连接一次，总是块的。10分钟就是人抛开了，断开是合适的
//
//

var userpool = {};
var cnt = 0;
var i = 0;
function getUserConnection(userid,cb){
    function initsb(){
        var connsb = {small:null,big:null};
        var conn = mysql.createConnection(connParam);
        //conn.connect();
        connsb.small = conn;
        conn = mysql.createConnection(connParam);
        console.log("初始化userConnection");
        connsb.big = conn;
        connsb.lastAccessTime = new Date();
        userpool[userid]=connsb;
        cb(null,connsb);
        /*
        conn.connect(function(err) {
          if (err) {
            return cb(err);
          }
        });
        */
        //conn.connect();
    };

    if (!userpool[userid]){
        console.log("i:"+i++);
        initsb();
    }else{
        let duration = (new Date() - userpool[userid].lastAccessTime)/1000/60;
        if (duration > 10){
            userpool[userid].small.end();
            userpool[userid].big.end();
            userpool[userid]=null;
            return initsb();
        }else return cb(null,userpool[userid]);
    }
}

releaseUserConnection = function(userid){
    if(userpool[userid]){
        console.log('userConnection %d will end now', userpool[userid].small.threadId);
        console.log('userConnection %d will end now', userpool[userid].big.threadId);
        userpool[userid].small.end();
        userpool[userid].big.end();
        //userpool[userid][1].release();

        userpool[userid]=null;
    }
}


//exports.getUserConnection = getUserConnection;



/********************************************
 *                                          *
 *                 回收站                   *
 *                                          *
 ********************************************/
//var single = (function(){
//    var unique;
//    function getInstance(){
//        if( unique === undefined ){
//            unique = new Construct();
//        }
//        return unique;
//    }
//    function Construct(){
//        // ... 生成单例的构造函数的代码
//    }
//    return {
//        getInstance : getInstance
//    }
//})();
/*
(function test1(a){
    console.log(111);
})();
*/

//2017年 09月 08日 星期五 11:00:36 CST
//改为单例类了
//function createPool(){
//    var pool = mysql.createPool(connParam);
//    
//    //下面这个循环放前面，免得一开始一大堆信息
//    //初始化五分之一就行了吧，也有30了呢！
//    //数据库缓存应该不是性能主要原因，哪怕开始的时候，所以初始化5个聊胜于无
//    //而且初始化后，就放到队列后面去了，也没有用
//    for (let i=0;i<2;i++){
//        pool.g1etConnection(function(err, connection) {
//            if(err) console.log(err);
//            else {connection.release();console.log("connection"+i+":"+connection.threadId);}
//        });
//    }
//
//    pool.on('connection', function (connection) {
//        console.log("new connection %d",connection.threadId);
//        //console.log(connection._events);
//    });
//    pool.on('release', function (connection) {
//        console.log('Connection %d released', connection.threadId);
//    });
//
//    pool.on('enqueue', function () {
//      console.log('Waiting for available connection slot');
//    });
//
//
//    return pool;
//}


//var pool = createPool();
//exports.releaseUserConnection1 = function(userid){
//    if(userpool[userid]){
//        userpool[userid][0].release();
//        userpool[userid][1].release();
//        userpool[userid]=null;
//    }
//}
//exports.g1etUserConnection1 = function(userid,cb){
//    //if (typeof(userpool[userid])=="undefined") userpool[userid]=null;
//    if (!userpool[userid]){
//        var pool3 = [];
//		pool.g1etConnection(function(err, conn1) {
//            if (err) return cb(err);
//            pool3.push(conn1);
//		    pool.g1etConnection(function(err, conn2) {
//                pool3.push(conn2);
//		        pool.g1etConnection(function(err, conn3) {
//                    pool3.push(conn3);
//                    userpool[userid]=pool3;
//                    cb(null,conn3);
//                });
//            });
//		});
//    }else{
//        cnt++;
//        return cb(null,userpool[userid][cnt%3]);
//    }
//}


/**
 * 这个sql包括insert into table(col1,col2,col3) values
 * rows，是传进来的数组，最后拼接成(col1value1,col2value1,col3value2),(col1value2,colo2value2,col3value3)
 */
/**
 * 如果是下面这种形式，那就是最简单的sql执行，没有封装的意义了
 * 不过conn是传进来的有点特别，如果把数组传进来，稍微有点用吧。
 */
/*
exports.batchInsert = function(sql,conn,cb){
    conn.query(sql,function(err,results){
        if (err){ cb(err);return}
        cb(null,results);
    });
} 
*/

//pool.on('connection', function (connection) {
  //connection.query('SET SESSION auto_increment_increment=1');
//  console.log(connection.threadId);
//});

//pool.on('enqueue', function () {
//  console.log('Waiting for available connection slot');
//});


//var connection = mysql.createConnection({
//     host     : 'localhost',
//     user     : 'lxm',
//     password : '',
//     database : 'r'
//});
