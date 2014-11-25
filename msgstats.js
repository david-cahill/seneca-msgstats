/* Copyright (c) 2013 Richard Rodger, MIT License */
"use strict";

var _                   = require('underscore')
var connect             = require('connect')
var serveStatic         = require('serve-static');
var influx              = require('influx');
var seneca2             = require('seneca')();
var seneca3             = require('seneca')();


module.exports = function( options ) {
  var seneca = this
  var plugin = 'msgstats'


  options = seneca.util.deepextend({
    capture:'role:*',
    format:['role'],
    prefix:'/msgstats/',
    contentprefix:'/msgstats',
    stats: {
      size:1024,
      duration:60000,
    },
  },options)
  
  //-----Server Section---//
  var client = influx({
    //cluster configuration
    hosts : [
      {
        host : options.influxOpts.host,
        port : options.influxOpts.port //optional. default 8086
      }
    ],
    // or single-host configuration
    host : options.influxOpts.host,
    port : options.influxOpts.port,// optional, default 8086
    username : options.influxOpts.username,
    password : options.influxOpts.password,
    database : options.influxOpts.database
  });

  function sendServerData() {
    seneca3.add({role:'data', cmd:'send'}, function(args,done){

    console.log(">>>>> sending point:", args.point);

    client.writePoint('actions', args.point, args.options, function(response) {
      console.log(">>>>>>","successfully sent data...." + response);
      done(null, {data:'received'});
    });

    });
  }

  function getServerData() {
    seneca3.add({role:'data', cmd: 'get'}, function(args, done) {
      client.query(args.query, function(err,response) {
            done(null,response);
        });
    });
  }

  seneca3
  .use(sendServerData)
  .use(getServerData)
  .listen(4000);

  //----------------------//

  seneca.add({role: plugin, ping: true}, ping);

  seneca.add( {role:'influxdb', cmd:'getData'}, function(args,callback) {
    getLatestChartData({fieldName:args.fieldName, seriesName:args.seriesName}, function(err,response) {
      callback(null,response);
    });
  });

  seneca.add( {role:'influxdb', cmd:'queryData'}, function(args,callback) {
    queryChartDataPattern({pattern:args.pattern, seriesName:args.seriesName}, function(err,response) {
      callback(null,response)
    });
  });

  seneca.wrap({role:'math', cmd:'*'}, function(args,done) {//captureData
    console.log("capture data args = " + JSON.stringify(args));
    console.log("**** capture data called, sending data to influxdb");
    var point = {
                  role:args.role,
                  cmd:args.cmd
                };
    // send point to seneca host service
    seneca2.client(4000).act({role:'data', cmd:'send', point:point, options:options}, function(err, result) {
      console.log("****** data send result", result);
    });

    this.prior(args,done);
  });

  function ping(args, done) {
    done(null, {now:Date.now()});
  };

  function getLatestChartData(args,done) {
    var query = 'SELECT ' + args.fieldName + ' FROM ' + args.seriesName;
    seneca2.client(4000).act({role:'data', cmd:'get', query:query}, function(err, result) {
      done(null,parseInfluxDataV2(result));
    });
  }

  function queryChartData(args,done) {
    console.log("args.pattern = " + args.pattern);
    var pattern = args.pattern;
    //pattern = Object.keys(pattern)[0];
    var splitPattern = pattern.split(":");
    var role = splitPattern[0];
    var cmd  = splitPattern[1];
    var query = "SELECT * FROM " + args.seriesName + " WHERE role ='"+role+ "' AND plugin ='"+cmd+"'";
    seneca2.client(4000).act({role:'data', cmd:'get', query:query}, function(err, result) {
      done(null,parseInfluxDataV2(result));
    });
  }

  function queryChartDataPattern(args,done) {
    console.log("args.pattern = " + args.pattern);
    var pattern = args.pattern;
    //pattern = Object.keys(pattern)[0];
    var splitPattern = pattern.split(":");
    var role = splitPattern[0];
    var cmd  = splitPattern[1];
    var query = "SELECT * FROM " + args.seriesName + " WHERE pattern ='"+args.pattern+"'";
    seneca2.client(4000).act({role:'data', cmd:'get', query:query}, function(err, result) {
      done(null,parseInfluxDataV2(result));
    });
  }

  function parseInfluxDataV2(data) {
    var columns = data[0].columns;
    var points  = data[0].points;
    var patternIndex = columns.indexOf("pattern");

    var result = [];
    var count = 1;
    var countedRoles = [];

    for(var i = 0; i<points.length; i++) {

      var containsRole = _.contains(countedRoles,points[i][patternIndex]);

      if(!containsRole) {
        result.push({pattern:points[i][patternIndex],
                     count:count
                    });
        countedRoles.push(points[i][patternIndex]);
      } else {

        for(var j = 0; j < result.length; j++) {
          if(result[j].pattern === points[i][patternIndex]) {
            result[j].count++;
          }
        }
    }

    }
    return result;
  }

  function captureAllMessagesV2(args, done) {
    //Check seneca args and look for capture fields in options.format.
    var captureFields = options.format;
    var point = {};

    for(var i = 0; i < captureFields.length; i++) {
      if(args[captureFields[i]]) {
        if(!point['pattern']) {
          point['pattern'] = captureFields[i]+':'+args[captureFields[i]];
        } else {
          point['pattern'] = point['pattern'] + ","+captureFields[i]+':'+args[captureFields[i]];
          //point['pattern'].push(captureFields[i]+'-'+args[captureFields[i]]);
        }
      }
    }

    console.log("**** Point To Send = ****" + JSON.stringify(point));

    seneca2.client(4000).act({role:'data', cmd:'send', point:point, options:options}, function(err, result) {
      console.log("****** data send result", result);
    });

    this.prior(args, done);
  }

  seneca.wrap(options.capture, captureAllMessagesV2);

  //-----API Section------//
  var data;
  function getData(cb) {
    seneca.act( {role:'influxdb', cmd:'getData', fieldName:'*', seriesName:'actions'}, function(err,result){
      cb(null,result);
    });
  }

  function queryInflux(pattern, cb) {
    seneca.act( {role:'influxdb', cmd:'queryData', pattern:pattern, seriesName:'actions'}, function(err,result){
      cb(null, result);
    });
  }

  var app = connect()
  app.use(serveStatic(__dirname+'/web'))

  var use = function(req,res,next){
    if( 0===req.url.indexOf(options.contentprefix) ) {
      if( 0 == req.url.indexOf(options.contentprefix+'/init.js') ) {
        res.writeHead(200,{'Content-Type':'text/javascript'})
        return res.end(initsrc+sourcelist.join('\n'));
      }
   
      req.url = req.url.substring(options.contentprefix.length)
      return app( req, res );
    }

    if(0 == req.url.indexOf('/influxdb/getData')) {
      var result = getData(function(err, response) {
        res.send(response);
      });
    } else if(0 == req.url.indexOf('/influxdb/queryInflux')){
      var result = queryInflux(req.param('actions'), function(err, response) {
        res.send(response);
      });
    }

    else return next();
  }

  seneca.add({init:plugin},function(args,done) {
    var seneca = this

    var config = {prefix:options.contentprefix}

    seneca.act({role:'web',use:use, plugin:plugin,config:config})

    seneca.act({role:'util',note:true,cmd:'push',key:'admin/units',value:{
      unit:'msg-stats',
      spec:{title:'Message Statistics',ng:{module:'senecaMsgStatsModule',directive:'seneca-msg-stats'}},
      content:[
        {type:'js',file:__dirname+'/web/msg-stats.js'}
      ]
    }})
    done()
  })


  return {
    name: plugin
  }
}